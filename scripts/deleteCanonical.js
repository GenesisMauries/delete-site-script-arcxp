// pa´borrar canonicas
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;

const BASE_URL = `${ORG_NAME}/draft/v1/story`;
const REPORT_PATH = `./reports-${WEBSITE_ID}/content_scan_results.json`;
const LOG_PATH = `./reports-${WEBSITE_ID}/deleted-canonical-${Date.now()}.jsonl`;

const headers = { Authorization: `Bearer ${API_KEY}` };

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const handleRateLimiting = async (responseHeaders) => {
    const remaining = parseInt(responseHeaders['x-ratelimit-remaining'], 10);
    const reset = parseInt(responseHeaders['x-ratelimit-reset'], 10) * 1000;

    if (!isNaN(remaining) && remaining <= 10 && !isNaN(reset)) {
        const waitTime = reset - Date.now() + 500;
        if (waitTime > 0) {
            console.log(`🚦 Esperando ${Math.round(waitTime / 1000)}s por límite de peticiones...`);
            await delay(waitTime);
        }
    }
};

const formatAxiosError = (error) => {
    if (error.response) {
        return `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración: ${error.message}`;
};

const deleteCanonicalNotes = async () => {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ Archivo no encontrado: ${REPORT_PATH}`);
        return;
    }

    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    const data = JSON.parse(raw.replace(/,\s*{}\s*]$/, ']'));
    const writer = fs.createWriteStream(LOG_PATH, { flags: 'a' });

    let deleted = 0;
    let failed = 0;

    for (const [index, note] of data.entries()) {
        const { _id, canonical_website } = note;

        if (canonical_website !== WEBSITE_ID) continue;

        const url = `${BASE_URL}/${_id}`;

        try {
            const res = await axios.delete(url, { headers });
            await handleRateLimiting(res.headers);

            deleted++;
            console.log(`🗑️ [${index + 1}] ${_id} eliminado`);

            writer.write(JSON.stringify({
                _id,
                status: 'deleted',
                website_id: WEBSITE_ID,
                timestamp: new Date().toISOString()
            }) + '\n');

        } catch (error) {
            const errMsg = formatAxiosError(error);
            failed++;
            console.error(`❌ [${index + 1}] Error al eliminar ${_id}: ${errMsg}`);

            writer.write(JSON.stringify({
                _id,
                status: 'error',
                website_id: WEBSITE_ID,
                error: errMsg,
                timestamp: new Date().toISOString()
            }) + '\n');

            await delay(1000);
        }

        await delay(200);
    }

    writer.end();
    console.log(`\n✅ Proceso completado.`);
    console.log(`   ✔️ Eliminadas: ${deleted}`);
    console.log(`   ❌ Errores: ${failed}`);
    console.log(`📄 Log en: ${LOG_PATH}`);
};

module.exports = {
    deleteCanonicalNotes
};

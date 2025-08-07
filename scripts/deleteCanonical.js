require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');

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
    const API_KEY = process.env.ARC_ACCESS_TOKEN;
    const ORG_NAME = process.env.CONTENT_BASE;
    const WEBSITE_ID = process.env.WEBSITE_ID;

    const BASE_URL = `${ORG_NAME}/draft/v1/story`;
    const REPORT_PATH = `./reports-${WEBSITE_ID}/content_scan_results.json`;
    const LOG_PATH = `./reports-${WEBSITE_ID}/deleted-canonical-${Date.now()}.jsonl`;

    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ Archivo no encontrado: ${REPORT_PATH}`);
        return;
    }

    const writer = fs.createWriteStream(LOG_PATH, { flags: 'a' });
    let deleted = 0;
    let failed = 0;
    let processed = 0;

    console.log('🚀 Iniciando proceso de borrado de canónicas por streaming...');

    await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(REPORT_PATH);
        const jsonStream = streamArray();

        fileStream.pipe(parser()).pipe(jsonStream);

        jsonStream.on('data', async ({ value: note }) => {
            jsonStream.pause(); 

            processed++;
            const { _id, canonical_website, type } = note;

            if (canonical_website !== WEBSITE_ID || type !== 'story') {
                jsonStream.resume(); 
                return;
            }

            const url = `${BASE_URL}/${_id}`;

            try {
                const res = await axios.delete(url, { headers });
                // console.log(`[DRY RUN] Se borraría la nota tipo '${type}' con ID: ${_id}`);
                await handleRateLimiting(res.headers);

                deleted++;
                console.log(`🗑️ [${processed}] Nota ${_id} eliminada.`);
                writer.write(JSON.stringify({ _id, status: 'deleted', timestamp: new Date().toISOString() }) + '\n');
            } catch (error) {
                const errMsg = formatAxiosError(error);
                failed++;
                console.error(`❌ [${processed}] Error al eliminar ${_id}: ${errMsg}`);
                writer.write(JSON.stringify({ _id, status: 'error', error: errMsg, timestamp: new Date().toISOString() }) + '\n');
                await delay(1000);
            }

            await delay(200); 
            jsonStream.resume(); a
        });

        jsonStream.on('end', resolve);
        jsonStream.on('error', reject);
    });

    writer.end();
    console.log(`\n✅ Proceso completado.`);
    console.log(`   Procesadas: ${processed}`);
    console.log(`   ✔️ Eliminadas: ${deleted}`);
    console.log(`   ❌ Errores: ${failed}`);
    console.log(`📄 Log en: ${LOG_PATH}`);
};

module.exports = {
    deleteCanonicalNotes
};
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;
const BASE_URL = `${ORG_NAME}/draft/v1/story`;

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
        return `Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración de la solicitud: ${error.message}`;
};

const descirculateContent = async () => {
    const reportPath = `./reports-${WEBSITE_ID}/content_scan_results.json`;
    const logPath = `./reports-${WEBSITE_ID}/descirculated-${Date.now()}.jsonl`;

    if (!fs.existsSync(reportPath)) {
        console.error(`❌ No se encontró el archivo: ${reportPath}`);
        return;
    }

    const raw = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(raw.replace(/,\s*{}\s*]$/, ']'));
    const writer = fs.createWriteStream(logPath, { flags: 'a' });

    let successCount = 0;
    let failCount = 0;

    for (const note of data) {
        const { _id, canonical_website, websites = {} } = note;

        if (!websites.hasOwnProperty(WEBSITE_ID) || canonical_website === WEBSITE_ID) continue;

        const url = `${BASE_URL}/${_id}/circulation/${WEBSITE_ID}`;

        try {
            const res = await axios.delete(url, { headers });
            await handleRateLimiting(res.headers);

            successCount++;
            console.log(`🔄 Nota ${_id} descirculada`);

            writer.write(JSON.stringify({
                _id,
                status: 'success',
                website_id: WEBSITE_ID,
                canonical_website,
                timestamp: new Date().toISOString()
            }) + '\n');

        } catch (error) {
            const errMsg = formatAxiosError(error);
            failCount++;
            console.error(`❌ Error en nota ${_id}: ${errMsg}`);

            writer.write(JSON.stringify({
                _id,
                status: 'error',
                website_id: WEBSITE_ID,
                canonical_website,
                error: errMsg,
                timestamp: new Date().toISOString()
            }) + '\n');

            await delay(1000); 
        }

        await delay(200); 
    }

    writer.end();
    console.log(`\n✅ Descirculación finalizada.`);
    console.log(`   ✔️  Éxitos: ${successCount}`);
    console.log(`   ❌ Errores: ${failCount}`);
    console.log(`📄 Log en: ${logPath}`);
};

module.exports = {
    descirculateContent
};

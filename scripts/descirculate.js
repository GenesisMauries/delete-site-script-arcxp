require('dotenv').config();
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { streamArray } = require('stream-json/streamers/StreamArray');
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
    const logPath = `./reports-${WEBSITE_ID}/descirculated.jsonl`;

    if (!fs.existsSync(reportPath)) {
        console.error(`❌ No se encontró el archivo: ${reportPath}`);
        return;
    }

    const writer = fs.createWriteStream(logPath, { flags: 'a' });

    let successCount = 0;
    let failCount = 0;

    const pipeline = chain([
        fs.createReadStream(reportPath, { encoding: 'utf8' }),
        parser(),
        streamArray()
    ]);

    pipeline.on('data', async ({ value: note }) => {

        const { _id, canonical_website, websites = {} } = note;
        if (canonical_website === WEBSITE_ID || !websites[WEBSITE_ID]) return;

        const url = `${BASE_URL}/${_id}/circulation/${WEBSITE_ID}`;

        try {
            const res = await axios.delete(url, { headers });
            await handleRateLimiting(res.headers);

            successCount++;
            writer.write(JSON.stringify({
                _id, status: 'success', website_id: WEBSITE_ID,
                canonical_website, timestamp: new Date().toISOString()
            }) + '\n');
            console.log(`🔄 Nota ${_id} descirculada`);

        } catch (err) {
            const msg = formatAxiosError(err);
            failCount++;
            writer.write(JSON.stringify({
                _id, status: 'error', website_id: WEBSITE_ID,
                canonical_website, error: msg, timestamp: new Date().toISOString()
            }) + '\n');
            console.error(`❌ Error en nota ${_id}: ${msg}`);
            await delay(1000);
        }
        await delay(200);

    });

    pipeline.on('end', () => {
        writer.end();
        console.log(`\n✅ Descirculación finalizada. Éxitos: ${successCount}, Errores: ${failCount}`);
        console.log(`📄 Log: ${logPath}`);
    });

    pipeline.on('error', err => {
        console.error('💥 Error en el stream:', err);
        writer.end();
    });
};

module.exports = {
    descirculateContent
};

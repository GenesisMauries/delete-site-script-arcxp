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
        return `Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración de la solicitud: ${error.message}`;
};

const descirculateContent = async () => {
    const API_KEY = process.env.ARC_ACCESS_TOKEN;
    const ORG_NAME = process.env.CONTENT_BASE;
    const WEBSITE_ID = process.env.WEBSITE_ID;
    const BASE_URL = `${ORG_NAME}/draft/v1/story`;
    const headers = { Authorization: `Bearer ${API_KEY}` };

    const reportPath = `./reports-${WEBSITE_ID}/content_scan_results.json`;
    const logPath = `./reports-${WEBSITE_ID}/descirculated-${Date.now()}.jsonl`;

    if (!fs.existsSync(reportPath)) {
        console.error(`❌ No se encontró el archivo de reporte: ${reportPath}`);
        return;
    }


    const writer = fs.createWriteStream(logPath, { flags: 'a' });
    let successCount = 0;
    let failCount = 0;
    let totalProcessed = 0;

    console.log('🚀 Iniciando proceso de descirculación por streaming...');

    await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(reportPath);
        const jsonStream = streamArray(); 

        fileStream.pipe(parser()).pipe(jsonStream);

        jsonStream.on('data', async ({ value: note }) => {
            jsonStream.pause();

            totalProcessed++;
            const { _id, canonical_website, websites = {} } = note;

            if (!websites || !_id || !websites.hasOwnProperty(WEBSITE_ID) || canonical_website === WEBSITE_ID) {
                jsonStream.resume();
                return;
            }

            const url = `${BASE_URL}/${_id}/circulation/${WEBSITE_ID}`;

            try {
                const res = await axios.delete(url, { headers });
                await handleRateLimiting(res.headers);
                successCount++;
                console.log(`[${totalProcessed}] 🔄 Nota ${_id} descirculada`);

                writer.write(JSON.stringify({ _id, status: 'success', website_id: WEBSITE_ID, timestamp: new Date().toISOString() }) + '\n');

            } catch (error) {
                const errMsg = formatAxiosError(error);
                failCount++;
                console.error(`[${totalProcessed}] ❌ Error en nota ${_id}: ${errMsg}`);

                writer.write(JSON.stringify({ _id, status: 'error', website_id: WEBSITE_ID, error: errMsg, timestamp: new Date().toISOString() }) + '\n');

                await delay(1000); 
            }

            await delay(200);

      
            jsonStream.resume();
        });

        jsonStream.on('end', () => {
            console.log('✅ Stream finalizado. Todas las notas han sido procesadas.');
            resolve();
        });

        jsonStream.on('error', (err) => {
            console.error('❌ Error fatal durante el streaming del JSON:', err);
            reject(err);
        });
    });

    writer.end();
    console.log(`\n🏁 Descirculación finalizada.`);
    console.log(`   Processed: ${totalProcessed}`);
    console.log(`   ✔️ Éxitos: ${successCount}`);
    console.log(`   ❌ Errores: ${failCount}`);
    console.log(`📄 Log de operaciones guardado en: ${logPath}`);
};

module.exports = {
    descirculateContent
};
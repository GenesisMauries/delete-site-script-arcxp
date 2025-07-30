require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;

const REPORT_PATH = `./reports-${WEBSITE_ID}/content_scan_results.json`;
const LOG_PATH = `./reports-${WEBSITE_ID}/deleted-photos-${Date.now()}.jsonl`;

const OPS_URL = `${ORG_NAME}/contentops/v1/delete`;

const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const deleteImages = async () => {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ No se encontró el archivo: ${REPORT_PATH}`);
        return;
    }

    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    const data = JSON.parse(raw.replace(/,\s*{}\s*]$/, ']'));
    const writer = fs.createWriteStream(LOG_PATH, { flags: 'a' });

    const seen = new Set();
    let deleted = 0;
    let failed = 0;
    let duplicated = 0;

    for (const [index, item] of data.entries()) {
        const id = item?.promo_items?.basic?._id;

        if (!id) continue;

        if (seen.has(id)) {
            duplicated++;
            console.log(`⚠️  [${index + 1}] Imagen duplicada: ${id}`);

            writer.write(JSON.stringify({
                _id: id,
                status: 'duplicated',
                timestamp: new Date().toISOString()
            }) + '\n');

            continue;
        }

        seen.add(id);

        const payload = {
            type: 'image-operation',
            _id: id,
            operation: 'delete'
        };

        try {
            const res = await axios.put(OPS_URL, payload, { headers });
            console.log(`✅ [${index + 1}] Imagen ${id} eliminada.`);

            writer.write(JSON.stringify({
                _id: id,
                status: 'deleted',
                timestamp: new Date().toISOString()
            }) + '\n');

            deleted++;
        } catch (err) {
            const errMsg = err.response
                ? `Status: ${err.response.status} - ${JSON.stringify(err.response.data)}`
                : err.message;

            console.error(`❌ [${index + 1}] Error eliminando ${id}: ${errMsg}`);

            writer.write(JSON.stringify({
                _id: id,
                status: 'error',
                error: errMsg,
                timestamp: new Date().toISOString()
            }) + '\n');

            failed++;
        }

        await delay(300);
    }

    writer.end();
    console.log('\n📋 Resumen:');
    console.log(`   ✔️ Eliminadas: ${deleted}`);
    console.log(`   ⚠️  Duplicadas: ${duplicated}`);
    console.log(`   ❌ Errores: ${failed}`);
    console.log(`📄 Log en: ${LOG_PATH}`);
};

module.exports = {
    deleteImages
};

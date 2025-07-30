// pa’ borrar galerías
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;
const PHOTO_API_BASE = `${ORG_NAME}/photo/api/v2`;
const REPORT_PATH = `./reports-${WEBSITE_ID}/content_scan_results.json`;
const LOG_PATH = `./reports-${WEBSITE_ID}/deleted-galleries-${Date.now()}.jsonl`;

const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatAxiosError = (error) => {
    if (error.response) {
        return `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración: ${error.message}`;
};

const deleteGalleries = async () => {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ No se encontró el archivo: ${REPORT_PATH}`);
        return;
    }

    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    const data = JSON.parse(raw.replace(/,\s*{}\s*]$/, ']'));
    const galleries = data.filter(item => item.type === 'gallery');

    if (galleries.length === 0) {
        console.log(`ℹ️ No se encontraron galerías relacionadas con ${WEBSITE_ID}.`);
        return;
    }

    const writer = fs.createWriteStream(LOG_PATH, { flags: 'a' });
    let deleted = 0;
    let failed = 0;

    console.log(`\n🖼️  Eliminando ${galleries.length} galerías...`);

    for (const [index, gallery] of galleries.entries()) {
        const id = gallery._id;
        console.log(`[${index + 1}/${galleries.length}] Eliminando galería: ${id}`);

        try {
            await axios.delete(`${PHOTO_API_BASE}/galleries/${id}`, { headers });
            writer.write(JSON.stringify({
                _id: id,
                status: 'deleted',
                timestamp: new Date().toISOString()
            }) + '\n');
            console.log(`  ✅ Eliminada`);
            deleted++;
        } catch (error) {
            const errMsg = formatAxiosError(error);
            writer.write(JSON.stringify({
                _id: id,
                status: 'error',
                error: errMsg,
                timestamp: new Date().toISOString()
            }) + '\n');
            console.error(`  ❌ Error: ${errMsg}`);
            failed++;
        }

        await delay(300);
    }

    writer.end();
    console.log('\n📋 Resumen:');
    console.log(`   ✔️ Eliminadas: ${deleted}`);
    console.log(`   ❌ Errores:   ${failed}`);
    console.log(`📄 Log: ${LOG_PATH}`);
};

module.exports = {
    deleteGalleries
};

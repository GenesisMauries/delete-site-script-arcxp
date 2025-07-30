// pa’ borrar secciones
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;
const SITE_API_BASE = `${ORG_NAME}/site/v3`;

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

const deleteSections = async () => {
    console.log('\n📂 Eliminando secciones del sitio...');
    const logPath = `./reports-${WEBSITE_ID}/deleted-sections-${Date.now()}.jsonl`;
    const writer = fs.createWriteStream(logPath, { flags: 'a' });
    let deleted = 0;
    let failed = 0;

    try {
        const response = await axios.get(`${SITE_API_BASE}/website/${WEBSITE_ID}/section/`, { headers: headers });
        let sections = response.data;

        if (!Array.isArray(sections) || sections.length === 0) {
            console.log('ℹ️ No se encontraron secciones que eliminar.');
            writer.end();
            return;
        }

        console.log(`🔍 Encontradas ${sections.length} secciones.`);
        // ⚠️ Advertencia
        console.log('================================================================');
        console.log('⚠️  ADVERTENCIA: Estás a punto de eliminar PERMANENTEMENTE TODAS las secciones del sitio.');
        console.log(`🎯 Sitio: ${WEBSITE_ID}`);
        console.log('⏳ El proceso comenzará en 10 segundos. Presiona Ctrl+C para cancelar.');
        console.log('================================================================');
        await delay(10000);
        sections.sort((a, b) => b._id.split('/').length - a._id.split('/').length);

        for (const [index, section] of sections.entries()) {
            const id = section._id;
            const name = section.name || 'Sin nombre';
            const url = `${SITE_API_BASE}/website/${WEBSITE_ID}/section/?_id=${encodeURIComponent(id)}`;

            console.log(`[${index + 1}/${sections.length}] Eliminando sección: ${id} (${name})`);

            try {
                await axios.delete(url, { headers: headers });
                console.log(`  ✅ Eliminada`);
                writer.write(JSON.stringify({
                    _id: id,
                    name,
                    status: 'deleted',
                    timestamp: new Date().toISOString()
                }) + '\n');
                deleted++;
                await delay(200);
            } catch (err) {
                const errMsg = formatAxiosError(err);
                console.error(`  ❌ Error: ${errMsg}`);
                writer.write(JSON.stringify({
                    _id: id,
                    name,
                    status: 'error',
                    error: errMsg,
                    timestamp: new Date().toISOString()
                }) + '\n');
                failed++;
                await delay(500);
            }
        }
    } catch (err) {
        console.error('❌ Error general al obtener secciones:', formatAxiosError(err));
    }

    writer.end();
    console.log('\n📋 Resumen:');
    console.log(`   ✔️ Eliminadas: ${deleted}`);
    console.log(`   ❌ Errores:   ${failed}`);
    console.log(`📄 Log: ${logPath}`);
}

module.exports = {
    deleteSections
};

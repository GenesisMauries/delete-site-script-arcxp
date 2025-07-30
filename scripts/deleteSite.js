const axios = require('axios');

const API_KEY = process.env.ARC_ACCESS_TOKEN;
const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;
const SITE_API_BASE = `${ORG_NAME}/site/v3`;

const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

const formatAxiosError = (error) => {
    if (error.response) {
        return `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración: ${error.message}`;
};

const deleteSite = async () => {
    console.log(`\n🗑️  Intentando eliminar el sitio: ${WEBSITE_ID}`);
    try {
        await axios.delete(`${SITE_API_BASE}/website/${WEBSITE_ID}`, { headers });
        console.log('✅ Sitio eliminado exitosamente.');
    } catch (error) {
        console.error('❌ Error crítico al eliminar el sitio:', formatAxiosError(error));
        console.log('ℹ️  Posibles causas: recursos restantes como secciones, notas, redirecciones, etc.');
        throw error;
    }
};

module.exports = {
    deleteSite
};

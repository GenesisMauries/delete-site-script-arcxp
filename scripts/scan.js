// Solo scan
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const ORG_NAME = process.env.CONTENT_BASE;
const WEBSITE_ID = process.env.WEBSITE_ID;

const BASE_URL = `${ORG_NAME}/content/v4`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatAxiosError = (error) => {
    if (error.response) {
        return `Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`;
    } else if (error.request) {
        return `No se recibió respuesta del servidor: ${error.message}`;
    }
    return `Error en la configuración de la solicitud: ${error.message}`;
};

const handleRateLimiting = async (headers) => {
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    if (isNaN(remaining) || remaining > 10) return;

    const resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
    const sleepTime = resetTime - Date.now() + 500;

    if (sleepTime > 0) {
        console.log(`🚦 Límite de peticiones cercano. Esperando ${Math.round(sleepTime / 1000)}s...`);
        await delay(sleepTime);
    }
};

const scanContent = async () => {
    if (!process.env.ARC_ACCESS_TOKEN || !process.env.CONTENT_BASE || !process.env.WEBSITE_ID) {
        const errorMessage = '❌ Error: Faltan variables de entorno requeridas en tu archivo .env:\n  - ARC_ACCESS_TOKEN\n  - CONTENT_BASE\n  - WEBSITE_ID';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    console.log(`🔍 Iniciando escaneo de contenido para el sitio: ${WEBSITE_ID}`);

    const reportDir = `./reports-${WEBSITE_ID}`;
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir);
        console.log(`📁 Directorio "${reportDir}" creado.`);
    }

    let baseName = 'content_scan_results.json';
    let reportPath = `${reportDir}/${baseName}`;
    let counter = 1;
    while (fs.existsSync(reportPath)) {
        baseName = `${counter}_content_scan_results.json`;
        reportPath = `${reportDir}/${baseName}`;
        counter++;
    }
    const writeStream = fs.createWriteStream(reportPath);
    let isFirstElement = true;

    const writeElements = (elements) => {
        elements.forEach(el => {
            if (!isFirstElement) {
                writeStream.write(',\n');
            }
            writeStream.write(JSON.stringify(el, null, 2));
            isFirstElement = false;
        });
    };


    const headers = {
        'Authorization': `Bearer ${process.env.ARC_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
    };
    const requestBody = {
        query: {
            bool: {
                minimum_should_match: 1,
                should: [
                    { match: { "type": "story" } },
                    { match: { "type": "gallery" } },
                    { match: { "type": "video" } }
                ],
            }
        }
    };

    writeStream.write('[\n');

    try {
        let scrollId = null;
        let totalCount = 0;


        const initialResponse = await axios.get(`${BASE_URL}/scan`, {
            headers,
            params: {
                website: WEBSITE_ID,
                body: JSON.stringify(requestBody),
                size: 100,
                _sourceInclude: '_id,type,canonical_website,website,websites,canonical_url,website_url, promo_items.basic',
            }
        });

        const initialElements = initialResponse.data.content_elements || [];
        if (initialElements.length > 0) {
            totalCount += initialElements.length;
            console.log(`📄 Página inicial: ${initialElements.length} elementos encontrados.`);
            writeElements(initialElements);
        }
        scrollId = initialResponse.data.next;

        while (scrollId) {
            try {
                const scrollResponse = await axios.get(`${BASE_URL}/scan`, {
                    headers,
                    params: {
                        website: WEBSITE_ID,
                        body: JSON.stringify(requestBody),
                        scrollId: scrollId,
                        size: 100,
                        _sourceInclude: '_id,type,canonical_website,website,websites,canonical_url,website_url, promo_items.basic',
                    }
                });

                const newElements = scrollResponse.data.content_elements;
                if (newElements && newElements.length > 0) {
                    totalCount += newElements.length;
                    console.log(`📄 Página siguiente: ${newElements.length} elementos encontrados. Total acumulado: ${totalCount}`);
                    writeElements(newElements);
                } else {
                    console.log('No hay más elementos que escanear.');
                    break;
                }

                scrollId = scrollResponse.data.next;
                await handleRateLimiting(scrollResponse.headers);

            } catch (err) {
                if (err.response?.status === 429) {
                    const wait = 5000;
                    console.warn(`⏳ Rate limit alcanzado. Esperando ${wait / 1000}s...`);
                    await delay(wait);
                    continue;
                } else {
                    console.error('❌ Error en el bucle de scroll:', formatAxiosError(err));
                    break;
                }
            }
        }

        writeStream.write('\n]');
        writeStream.end();

        writeStream.on('finish', () => {
            console.log(`\n✅ Escaneo completado. Total de elementos encontrados: ${totalCount}`);
            console.log(`📦 Reporte guardado en: ${reportPath}`);
        });

    } catch (error) {
        console.error('❌ Error fatal durante el escaneo de contenido:', formatAxiosError(error));
        writeStream.end();
        throw error;
    }
};

module.exports = {
    scanContent
};

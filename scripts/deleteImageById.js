
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const orgID = process.env.CONTENT_BASE;;
const accessToken = process.env.ARC_ACCESS_TOKEN;;
const website = process.env.WEBSITE_ID;
const dryRun = true;

const deletedLogPath = `./reports-${website}/deleted_photos.jsonl`
const dryRunLogPath = `./reports-${website}/dryrun_photos.jsonl`;


fs.writeFileSync(dryRunLogPath, '');
fs.writeFileSync(deletedLogPath, '');

const headers = {
    Authorization: `Bearer 24SKEVVGFBV7E5QV6G97C9615L6RIGP7q15RmmgnCEeCIMyZCDPRIv6rH2SlOQLjX8qzfl1y`,
    'Content-Type': 'application/json'
};

async function getPhotos(website, offset = 0, limit = 50) {
    const url = `https://api.metroworldnews.arcpublishing.com/photo/api/v2/photos`;

    try {
        const res = await axios.get(url, {
            headers,
            params: {
                primaryWebsite: website,
                offset,
                limit
            }
        });

        return res.data || [];
    } catch (error) {
        if (error.response) {
            console.error(`❌ Error al obtener fotos:`, error.response.status, error.response.statusText);
            console.error('🧾 Detalle:', error.response.data);
        } else if (error.request) {
            console.error('❌ No hubo respuesta del servidor.');
            console.error('📡 Request:', error.request);
        } else {
            console.error('❌ Error al configurar la solicitud:', error.message);
        }
        return [];
    }
}

async function deletePhoto(photoId) {
    const url = `https://api.metroworldnews.arcpublishing.com/photo/api/v2/photos/${photoId}`;

    try {
        await axios.delete(url, { headers });
        return true;
    } catch (error) {
        console.error(`❌ Error al eliminar ${photoId}:`, error.response?.status, error.response?.statusText);
        return false;
    }
}

function logJsonLine(filePath, photo) {
    const data = {
        id: photo._id || photo.id,
        originalName: photo.originalName || null,
        caption: photo.caption || null,
        created_date: photo.created_date || null,
        updated_date: photo.updated_date || null
    };

    fs.appendFileSync(filePath, JSON.stringify(data) + '\n');
}

async function deleteAllPhotos() {
    let offset = 0;
    const limit = 50;
    let totalProcessed = 0;

    while (true) {
        const photos = await getPhotos(website, offset, limit);
        if (photos.length === 0) break;

        for (const photo of photos) {
            const photoId = photo._id || photo.id;

            if (dryRun) {
                console.log(`🔍 [dry-run] Imagen que se eliminaría: ${photoId}`);
                logJsonLine(dryRunLogPath, photo);
            } else {
                const success = await deletePhoto(photoId);
                if (success) {
                    console.log(`✅ Imagen eliminada: ${photoId}`);
                    logJsonLine(deletedLogPath, photo);
                }
            }

            totalProcessed++;
        }

        offset += limit;
    }

    console.log(`\n🎯 Total de imágenes ${dryRun ? 'detectadas (dry-run)' : 'eliminadas'}: ${totalProcessed}`);
    console.log(`📝 Log guardado en: ${dryRun ? dryRunLogPath : deletedLogPath}`);
}

deleteAllPhotos();
module.exports = {
    deleteAllPhotos
};

// pa'los videos
require('dotenv').config();
const fs = require('fs');

const WEBSITE_ID = process.env.WEBSITE_ID;
const REPORT_PATH = `./reports-${WEBSITE_ID}/content_scan_results.json`;
const OUTPUT_PATH = `./reports-${WEBSITE_ID}/videos-${Date.now()}.json`;

const videosReport = () => {
    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ No se encontró el archivo: ${REPORT_PATH}`);
        return;
    }

    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    const data = JSON.parse(raw.replace(/,\s*{}\s*]$/, ']'));

    const filtered = data.filter(item =>
        item.type === 'video' &&
        (item.canonical_website === WEBSITE_ID || item.websites?.[WEBSITE_ID])
    );

    if (filtered.length === 0) {
        console.log(`ℹ️ No se encontraron videos relacionados con ${WEBSITE_ID}.`);
        return;
    }

    const simplified = filtered.map(video => ({
        _id: video._id,
        canonical_website: video.canonical_website,
        canonical_url: video.canonical_url || '',
        website_url: video.websites?.[WEBSITE_ID]?.website_url || '',
        promo_image: video.promo_items?.basic?.url || ''
    }));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(simplified, null, 2), 'utf8');
    console.log(`✅ JSON generado: ${OUTPUT_PATH}`);
    console.log(`📄 Videos encontrados: ${filtered.length}`);
};

module.exports = {
    videosReport
};

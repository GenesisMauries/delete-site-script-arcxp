const ORG_NAME = process.env.CONTENT_BASE;
const API_KEY = process.env.ARC_ACCESS_TOKEN;

async function getPhotoInfo(photoId) {
    const url = `https://api.metroworldnews.arcpublishing.com/photo/api/v2/photos/${photoId}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer 24SKEVVGFBV7E5QV6G97C9615L6RIGP7q15RmmgnCEeCIMyZCDPRIv6rH2SlOQLjX8qzfl1y`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const photoData = await response.json();
        console.log(photoData, '*************************************');
        
        return photoData;

    } catch (error) {
        console.error('Error fetching photo info:', error);
        return null;
    }
}



module.exports = {
    getPhotoInfo
};

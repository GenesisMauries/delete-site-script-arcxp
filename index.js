#!/usr/bin/env node

const commands = {
    scan: () => require('./scripts/scan').scanContent(),
    descirculate: () => require('./scripts/descirculate').descirculateContent(),
    'delete-canonical': () => require('./scripts/deleteCanonical').deleteCanonicalNotes(),
    'delete-sections': () => require('./scripts/deleteSections').deleteSections(),
    'videos-report': () => require('./scripts/videosReport').videosReport(),
    'delete-galleries': () => require('./scripts/deleteGalleries').deleteGalleries(),
    'delete-photos': () => require('./scripts/deleteImageById').deleteAllPhotos(),
    'delete-site': () => require('./scripts/deleteSite').deleteSite(),
    'get-photo': () => require('./scripts/getPhotoById').getPhotoInfo('QMR6JBITVZDKTPVQTT3OYCISPI')
};

const showHelp = () => {
    console.log('=> Comandos disponibles:');
    Object.keys(commands).forEach(cmd => {
        console.log(`  • ${cmd}`);
    });
    console.log('\n *_* Uso: npm run cmd <comando> o node index.js <comando>');
};

const main = async () => {
    const [command] = process.argv.slice(2);

    if (!command || command === 'help' || command === '--help') {
        showHelp();
        return;
    }

    const commandFunction = commands[command];

    if (!commandFunction) {
        console.error(`:/ Comando "${command}" no reconocido.\n`);
        showHelp();
        process.exit(1);
    }

    try {
        console.log(`---> Ejecutando: ${command}...`);
        await commandFunction();
        console.log(`;) Comando "${command}" completado exitosamente.`);
    } catch (error) {
        console.error(`:0 Error ejecutando "${command}":`, error.message);
        process.exit(1);
    }
};


process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Excepción no capturada:', error);
    process.exit(1);
});

main();
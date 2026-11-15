const { createClient } = require('redis');

const redisClient = process.env.REDIS_URL
    ? createClient({
        url: process.env.REDIS_URL,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 500, 5000),
        },
    })
    : null;

if (redisClient) {
    redisClient.on('error', (error) => {
        console.error('[Redis] Error de conexión:', error.message);
    });
    redisClient.on('ready', () => {
        console.info('[Redis] Conexión lista.');
    });
    redisClient.on('reconnecting', () => {
        console.warn('[Redis] Reconectando...');
    });

    redisClient.connect().catch((error) => {
        console.error('[Redis] No se pudo iniciar la conexión:', error.message);
    });
} else {
    console.warn('[Redis] REDIS_URL no está configurada; los límites distribuidos están desactivados.');
}

module.exports = { redisClient };

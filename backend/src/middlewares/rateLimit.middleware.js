const windows = new Map();

/**
 * Rate limiter simple en memoria por IP.
 * @param {Object} options
 * @param {number} options.windowMs - Ventana de tiempo en ms.
 * @param {number} options.max - Máximo de requests por ventana.
 * @param {string} options.message - Mensaje de error.
 */
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 5, message = 'Demasiadas solicitudes. Intenta más tarde.' } = {}) => {
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`;
        const now = Date.now();
        const entry = windows.get(key) || { count: 0, resetAt: now + windowMs };

        if (now > entry.resetAt) {
            entry.count = 0;
            entry.resetAt = now + windowMs;
        }

        entry.count += 1;
        windows.set(key, entry);

        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({
                status: 'error',
                message,
                retry_after_seconds: retryAfter
            });
        }

        next();
    };
};

// Limpieza periódica para evitar fugas de memoria.
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows.entries()) {
        if (now > entry.resetAt + 60000) windows.delete(key);
    }
}, 5 * 60 * 1000).unref();

module.exports = { createRateLimiter };
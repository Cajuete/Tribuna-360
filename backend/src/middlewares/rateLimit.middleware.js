const crypto = require('crypto');
const { redisClient } = require('../config/redis');

const INCREMENT_AND_SET_EXPIRY = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('PTTL', KEYS[1]) }
`;

const createRateLimiter = ({
    windowMs = 15 * 60 * 1000,
    max = 5,
    message = 'Demasiadas solicitudes. Intenta más tarde.',
} = {}) => {
    let lastAvailabilityWarning = 0;

    return async (req, res, next) => {
        if (!redisClient || !redisClient.isReady) {
            const now = Date.now();
            if (now - lastAvailabilityWarning > 60000) {
                console.warn('[RateLimit] Redis no está disponible; se permite la solicitud (fail-open).');
                lastAvailabilityWarning = now;
            }
            return next();
        }

        const identity = req.user?.id || req.ip || req.socket.remoteAddress || 'unknown';
        const route = `${req.baseUrl}${req.path}`;
        const identityHash = crypto.createHash('sha256').update(identity).digest('hex');
        const key = `tribuna360:rate-limit:v1:${windowMs}:${max}:${route}:${identityHash}`;

        try {
            const [count, ttl] = await redisClient.eval(INCREMENT_AND_SET_EXPIRY, {
                keys: [key],
                arguments: [String(windowMs)],
            });

            const remaining = Math.max(0, max - Number(count));
            const retryAfter = Math.max(1, Math.ceil(Number(ttl) / 1000));
            res.set('RateLimit-Limit', String(max));
            res.set('RateLimit-Remaining', String(remaining));
            res.set('RateLimit-Reset', String(retryAfter));

            if (Number(count) > max) {
                res.set('Retry-After', String(retryAfter));
                return res.status(429).json({
                    status: 'error',
                    message,
                    retry_after_seconds: retryAfter,
                });
            }

            return next();
        } catch (error) {
            const now = Date.now();
            if (now - lastAvailabilityWarning > 60000) {
                console.error('[RateLimit] No se pudo consultar Redis; se permite la solicitud (fail-open):', error.message);
                lastAvailabilityWarning = now;
            }
            return next();
        }
    };
};

module.exports = { createRateLimiter };

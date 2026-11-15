const crypto = require('crypto');
const { redisClient } = require('../config/redis');

const QUEUE_SCRIPT = `
local waitingKey = KEYS[1]
local admittedKey = KEYS[2]
local member = ARGV[1]
local now = tonumber(ARGV[2])
local accessTtl = tonumber(ARGV[3])
local maxActive = tonumber(ARGV[4])
local maxWaitingMs = tonumber(ARGV[5])
local action = ARGV[6]
local redisTime = redis.call('TIME')
local queueNow = tonumber(redisTime[1]) * 1000000 + tonumber(redisTime[2])

redis.call('ZREMRANGEBYSCORE', admittedKey, '-inf', now)
redis.call('ZREMRANGEBYSCORE', waitingKey, '-inf', queueNow - maxWaitingMs * 1000)

if action == 'join' then
  if not redis.call('ZSCORE', admittedKey, member) then
    redis.call('ZADD', waitingKey, 'NX', queueNow, member)
  end
elseif action == 'leave' then
  redis.call('ZREM', waitingKey, member)
  if redis.call('EXISTS', admittedKey .. ':purchase:' .. member) == 0 then
    redis.call('ZREM', admittedKey, member)
  end
end

local activeCount = redis.call('ZCARD', admittedKey)
while activeCount < maxActive do
  local nextMember = redis.call('ZPOPMIN', waitingKey, 1)
  if #nextMember == 0 then
    break
  end
  redis.call('ZADD', admittedKey, now + accessTtl, nextMember[1])
  activeCount = activeCount + 1
end

redis.call('EXPIRE', waitingKey, 21600)
redis.call('EXPIRE', admittedKey, 21600)
local expiresAt = redis.call('ZSCORE', admittedKey, member)
if expiresAt then
  return { 'admitted', 0, expiresAt, activeCount, redis.call('ZCARD', waitingKey) }
end

local rank = redis.call('ZRANK', waitingKey, member)
if rank then
  return { 'waiting', rank + 1, 0, activeCount, redis.call('ZCARD', waitingKey) }
end

return { 'not_joined', 0, 0, activeCount, redis.call('ZCARD', waitingKey) }
`;

const CLAIM_PURCHASE_SCRIPT = `
local expiresAt = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not expiresAt or tonumber(expiresAt) <= tonumber(ARGV[2]) then
  return 'expired'
end
local claimed = redis.call('SET', KEYS[2], '1', 'NX', 'PX', ARGV[3])
if claimed then
  return 'claimed'
end
return 'processing'
`;

const isEnabled = () => process.env.WAITING_ROOM_ENABLED === 'true';

const getSettings = () => {
    const secret = process.env.QUEUE_TOKEN_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
        throw new Error('QUEUE_TOKEN_SECRET debe tener al menos 32 bytes.');
    }

    const maxActive = Number.parseInt(process.env.WAITING_ROOM_MAX_ACTIVE || '50', 10);
    const accessTtlMs = Number.parseInt(process.env.WAITING_ROOM_ACCESS_MS || '600000', 10);
    if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > 2000) {
        throw new Error('WAITING_ROOM_MAX_ACTIVE debe ser un entero entre 1 y 2000.');
    }
    if (!Number.isInteger(accessTtlMs) || accessTtlMs < 60000 || accessTtlMs > 3600000) {
        throw new Error('WAITING_ROOM_ACCESS_MS debe estar entre 60000 y 3600000.');
    }

    return { secret, maxActive, accessTtlMs };
};

const queueKeys = (matchId) => ({
    waiting: `tribuna360:queue:v1:${matchId}:waiting`,
    admitted: `tribuna360:queue:v1:${matchId}:admitted`,
});

const signToken = (payload, secret) => {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
};

const parseToken = (token, secret) => {
    if (typeof token !== 'string' || token.length > 2048) return null;
    const [encodedPayload, signature, extra] = token.split('.');
    if (!encodedPayload || !signature || extra !== undefined) return null;

    const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
    let received;
    try {
        received = Buffer.from(signature, 'base64url');
    } catch {
        return null;
    }
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        if (
            typeof payload.user_id !== 'string' ||
            typeof payload.match_id !== 'string' ||
            !Number.isInteger(payload.expires_at) ||
            payload.expires_at <= Date.now()
        ) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
};

const issueAccess = (userId, matchId, expiresAt, secret) => {
    const payload = { user_id: userId, match_id: matchId, expires_at: Number(expiresAt) };
    return {
        token: signToken(payload, secret),
        expires_at: new Date(payload.expires_at).toISOString(),
    };
};

const executeQueueAction = async ({ matchId, userId, action }) => {
    const { secret, maxActive, accessTtlMs } = getSettings();
    const bypass = () => {
        console.warn('[WaitingRoom] Redis no está disponible; se permite acceso temporal (fail-open).');
        if (action === 'leave') {
            return {
                status: 'not_joined',
                position: 0,
                active_count: 0,
                waiting_count: 0,
                bypass: true,
            };
        }
        const access = issueAccess(userId, matchId, Date.now() + 60000, secret);
        return {
            status: 'admitted',
            position: 0,
            active_count: 0,
            waiting_count: 0,
            access_token: access.token,
            expires_at: access.expires_at,
            bypass: true,
        };
    };
    if (!redisClient?.isReady) {
        return bypass();
    }

    try {
        const keys = queueKeys(matchId);
        const result = await redisClient.eval(QUEUE_SCRIPT, {
            keys: [keys.waiting, keys.admitted],
            arguments: [
                userId,
                String(Date.now()),
                String(accessTtlMs),
                String(maxActive),
                String(6 * 60 * 60 * 1000),
                action,
            ],
        });

        const [status, position, expiresAt, activeCount, waitingCount] = result;
        const response = {
            status: String(status),
            position: Number(position),
            active_count: Number(activeCount),
            waiting_count: Number(waitingCount),
            bypass: false,
        };
        if (response.status === 'admitted') {
            const access = issueAccess(userId, matchId, Number(expiresAt), secret);
            response.access_token = access.token;
            response.expires_at = access.expires_at;
        }
        return response;
    } catch (error) {
        console.error('[WaitingRoom] Falló la operación Redis; se permite acceso temporal (fail-open):', error.message);
        return bypass();
    }
};

const joinQueue = ({ matchId, userId }) => executeQueueAction({ matchId, userId, action: 'join' });
const getQueueStatus = ({ matchId, userId }) => executeQueueAction({ matchId, userId, action: 'status' });
const leaveQueue = ({ matchId, userId }) => executeQueueAction({ matchId, userId, action: 'leave' });

const verifyPurchaseAccess = async ({ token, matchId, userId }) => {
    const { secret, accessTtlMs } = getSettings();
    const payload = parseToken(token, secret);
    if (!payload || payload.match_id !== matchId || payload.user_id !== userId) {
        return { ok: false, reason: 'Se requiere una autorización vigente de la fila virtual para este partido.' };
    }

    if (!redisClient?.isReady) {
        console.warn('[WaitingRoom] Redis no está disponible durante la compra; se permite el acceso firmado (fail-open).');
        return { ok: true, bypass: true };
    }

    try {
        const { admitted } = queueKeys(matchId);
        const claimKey = `${admitted}:purchase:${userId}`;
        const claimResult = await redisClient.eval(CLAIM_PURCHASE_SCRIPT, {
            keys: [admitted, claimKey],
            arguments: [userId, String(Date.now()), String(accessTtlMs)],
        });
        if (claimResult === 'expired') {
            return { ok: false, reason: 'Tu turno de compra venció. Vuelve a unirte a la fila virtual.' };
        }
        if (claimResult !== 'claimed') {
            return { ok: false, reason: 'Ya hay una compra en proceso con tu turno. Espera a que termine.' };
        }
        return { ok: true, bypass: false };
    } catch (error) {
        console.error('[WaitingRoom] No se pudo verificar el turno; se permite el acceso firmado (fail-open):', error.message);
        return { ok: true, bypass: true };
    }
};

const releasePurchaseAccess = async ({ matchId, userId }) => {
    if (redisClient?.isReady) {
        const { admitted } = queueKeys(matchId);
        try {
            await redisClient.del(`${admitted}:purchase:${userId}`);
        } catch (error) {
            console.error('[WaitingRoom] No se pudo liberar el bloqueo de compra:', error.message);
        }
    }
    return leaveQueue({ matchId, userId });
};

module.exports = {
    getQueueStatus,
    isEnabled,
    joinQueue,
    leaveQueue,
    releasePurchaseAccess,
    verifyPurchaseAccess,
};

const {
    getQueueStatus,
    isEnabled,
    joinQueue,
    leaveQueue,
} = require('../services/virtualQueue.service');

const isValidMatchId = (matchId) =>
    typeof matchId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId);

const sendQueueAction = (action) => async (req, res) => {
    if (!isEnabled()) {
        return res.status(200).json({
            success: true,
            data: { status: 'disabled' },
        });
    }

    if (!isValidMatchId(req.params.matchId)) {
        return res.status(400).json({ success: false, message: 'Identificador de partido inválido.' });
    }

    try {
        const handler = {
            join: joinQueue,
            status: getQueueStatus,
            leave: leaveQueue,
        }[action];
        const data = await handler({
            matchId: req.params.matchId,
            userId: req.user.id,
        });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(`[WaitingRoom] Error en acción ${action}:`, error.message);
        return res.status(503).json({
            success: false,
            message: 'La fila virtual no está configurada correctamente. Contacta al administrador.',
        });
    }
};

module.exports = {
    getQueueStatus: sendQueueAction('status'),
    joinQueue: sendQueueAction('join'),
    leaveQueue: sendQueueAction('leave'),
};

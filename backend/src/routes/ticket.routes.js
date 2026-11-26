const { Router } = require('express');
const { purchaseTicket, getMyTickets, getTickets, scanTicket, getOfflineMatches, getOfflineTicketManifest, syncOfflineTicketScans, supportSearchTickets, supportRegenerateTicket } = require('../controllers/ticket.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const { getQueueStatus, joinQueue, leaveQueue } = require('../controllers/virtualQueue.controller');

const router = Router();

const purchaseLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Demasiadas compras. Intenta nuevamente en un minuto.' });
const queueJoinLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 3, message: 'Intenta unirte nuevamente a la fila en un minuto.' });
const queueStatusLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'Demasiadas consultas a la fila. Espera un minuto.' });
const queueLeaveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 5, message: 'Demasiados intentos de salir de la fila.' });
const scanLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300, message: 'Demasiados escaneos. Espera un minuto antes de continuar.' });
const offlineSyncLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'Demasiadas sincronizaciones. Intenta nuevamente en un minuto.' });

router.post('/purchase', verifyToken, requireRole(['box_office_cashier']), purchaseLimiter, purchaseTicket);
router.post('/queue/:matchId/join', verifyToken, requireRole(['fan']), queueJoinLimiter, joinQueue);
router.get('/queue/:matchId', verifyToken, requireRole(['fan']), queueStatusLimiter, getQueueStatus);
router.delete('/queue/:matchId', verifyToken, requireRole(['fan']), queueLeaveLimiter, leaveQueue);
router.get('/mine', verifyToken, requireRole(['fan']), getMyTickets);
router.get('/support/search', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), supportSearchTickets);
router.post('/:id/regenerate', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), supportRegenerateTicket);
router.get('/offline/matches', verifyToken, requireRole(['superadmin', 'gate_operator']), getOfflineMatches);
router.get('/offline/manifest', verifyToken, requireRole(['superadmin', 'gate_operator']), getOfflineTicketManifest);
router.post('/offline/sync', verifyToken, offlineSyncLimiter, requireRole(['superadmin', 'gate_operator']), syncOfflineTicketScans);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'financial_auditor', 'box_office_cashier']), getTickets);
router.post('/scan', verifyToken, scanLimiter, requireRole(['superadmin', 'gate_operator']), scanTicket);

module.exports = router;

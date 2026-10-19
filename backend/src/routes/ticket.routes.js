const { Router } = require('express');
const { purchaseTicket, getMyTickets, scanTicket } = require('../controllers/ticket.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/purchase', verifyToken, purchaseTicket);
router.get('/mine', verifyToken, getMyTickets);
router.post('/scan', verifyToken, requireRole(['superadmin', 'club_admin', 'gate_operator']), scanTicket);

module.exports = router;

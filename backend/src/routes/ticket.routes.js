const { Router } = require('express');
const { purchaseTicket, scanTicket } = require('../controllers/ticket.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
router.post('/purchase', verifyToken, purchaseTicket);
router.post('/scan', verifyToken, requireRole(['superadmin', 'club_admin', 'gate_operator']), scanTicket);

module.exports = router;
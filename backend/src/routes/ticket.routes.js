const { Router } = require('express');
const { purchaseTicket, getMyTickets, getTickets, scanTicket } = require('../controllers/ticket.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/purchase', verifyToken, purchaseTicket);
router.get('/mine', verifyToken, getMyTickets);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), getTickets);
router.post('/scan', verifyToken, requireRole(['superadmin', 'gate_operator']), scanTicket);

module.exports = router;

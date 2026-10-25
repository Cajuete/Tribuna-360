const { Router } = require('express');
const { purchaseTicket, getMyTickets, getTickets, scanTicket, supportSearchTickets, supportRegenerateTicket } = require('../controllers/ticket.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/purchase', verifyToken, purchaseTicket);
router.get('/mine', verifyToken, getMyTickets);
router.get('/support/search', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), supportSearchTickets);
router.post('/:id/regenerate', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), supportRegenerateTicket);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'financial_auditor', 'box_office_cashier']), getTickets);
router.post('/scan', verifyToken, requireRole(['superadmin', 'gate_operator']), scanTicket);

module.exports = router;

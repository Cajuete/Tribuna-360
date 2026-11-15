const { Router } = require('express');
const { getMyOrders, getOrders, updateOrderStatus } = require('../controllers/order.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/', verifyToken, (_req, res) => res.status(410).json({
    success: false,
    message: 'El pago simulado fue desactivado. Inicia la compra mediante el checkout de Tribuna 360.',
}));
router.get('/mine', verifyToken, getMyOrders);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'financial_auditor', 'customer_support']), getOrders);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), updateOrderStatus);

module.exports = router;

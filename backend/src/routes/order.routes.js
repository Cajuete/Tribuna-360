const { Router } = require('express');
const { createOrder, getMyOrders, getOrders, updateOrderStatus } = require('../controllers/order.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/', verifyToken, createOrder);
router.get('/mine', verifyToken, getMyOrders);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), getOrders);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), updateOrderStatus);

module.exports = router;

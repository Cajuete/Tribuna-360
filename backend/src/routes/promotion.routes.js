const { Router } = require('express');
const { getPromotions, createPromotion, updatePromotion, deletePromotion, getSalesMetrics } = require('../controllers/promotion.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/metrics', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), getSalesMetrics);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), getPromotions);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), createPromotion);
router.put('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), updatePromotion);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), deletePromotion);

module.exports = router;
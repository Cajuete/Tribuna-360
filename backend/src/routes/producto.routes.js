const { Router } = require('express');
const { getProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/producto.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', optionalAuth, getProducts);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), createProduct);
router.put('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), updateProduct);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), deleteProduct);

module.exports = router;
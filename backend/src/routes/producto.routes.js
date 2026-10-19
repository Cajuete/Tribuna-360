const { Router } = require('express');
const { getProducts, createProduct, deleteProduct } = require('../controllers/producto.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getProducts);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), createProduct);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), deleteProduct);

module.exports = router;
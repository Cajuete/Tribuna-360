const { Router } = require('express');
const { getProducts, createProduct } = require('../controllers/producto.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getProducts);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), createProduct);

module.exports = router;
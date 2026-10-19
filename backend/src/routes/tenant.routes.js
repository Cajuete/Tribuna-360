const { Router } = require('express');
const { getTenants, createTenant, updateTenant } = require('../controllers/tenant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getTenants);
router.post('/', verifyToken, requireRole(['superadmin']), createTenant);
router.patch('/:id', verifyToken, requireRole(['superadmin']), updateTenant);

module.exports = router;

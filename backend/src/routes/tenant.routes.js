const { Router } = require('express');
const { getTenants, getTenantBySlug, createTenant, updateTenant } = require('../controllers/tenant.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getTenants);
router.get('/:slug', getTenantBySlug);
router.post('/', verifyToken, requireRole(['superadmin']), createTenant);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updateTenant);

module.exports = router;

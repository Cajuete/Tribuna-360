const { Router } = require('express');
const { getTenants, getTenantBySlug, getDeliverySettings, getMyFollowedTenants, followTenant, unfollowTenant, createTenant, updateTenant } = require('../controllers/tenant.controller');
const { verifyToken, optionalAuth, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getTenants);
router.get('/follows/mine', optionalAuth, getMyFollowedTenants);
router.post('/:tenantId/follow', verifyToken, requireRole(['fan']), followTenant);
router.delete('/:tenantId/follow', verifyToken, requireRole(['fan']), unfollowTenant);
router.get('/delivery-settings/:tenantId', getDeliverySettings);
router.get('/:slug', getTenantBySlug);
router.post('/', verifyToken, requireRole(['superadmin']), createTenant);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updateTenant);

module.exports = router;

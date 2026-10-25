const { Router } = require('express');
const { getPackages, createPackage, updatePackage, deletePackage } = require('../controllers/package.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
const roles = ['superadmin', 'club_admin', 'sales_manager'];

router.get('/', verifyToken, requireRole(roles), getPackages);
router.post('/', verifyToken, requireRole(roles), createPackage);
router.put('/:id', verifyToken, requireRole(roles), updatePackage);
router.delete('/:id', verifyToken, requireRole(roles), deletePackage);

module.exports = router;
const { Router } = require('express');
const { getUsers, createUser, updateManagedUserProfile, setManagedUserActive, assignRole, resetUserPassword, getMe, updateMe } = require('../controllers/user.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);

router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), getUsers);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin']), createUser);
router.patch('/:id/profile', verifyToken, requireRole(['superadmin', 'club_admin']), updateManagedUserProfile);
router.patch('/:id/status', verifyToken, requireRole(['superadmin', 'club_admin']), setManagedUserActive);
router.patch('/:id/password', verifyToken, requireRole(['superadmin', 'club_admin', 'customer_support']), resetUserPassword);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), assignRole);

module.exports = router;

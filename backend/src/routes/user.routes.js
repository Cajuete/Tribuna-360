const { Router } = require('express');
const { getUsers, createUser, assignRole } = require('../controllers/user.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', verifyToken, requireRole(['superadmin', 'club_admin']), getUsers);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin']), createUser);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), assignRole);

module.exports = router;

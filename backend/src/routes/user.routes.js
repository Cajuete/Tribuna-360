const { Router } = require('express');
const { getUsers, assignRole } = require('../controllers/user.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', verifyToken, requireRole(['superadmin']), getUsers);
router.patch('/:id', verifyToken, requireRole(['superadmin']), assignRole);

module.exports = router;

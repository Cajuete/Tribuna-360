const { Router } = require('express');
const { checkAuthStatus, register, login, me } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/status', checkAuthStatus);
router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, me);

module.exports = router;

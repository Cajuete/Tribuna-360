const { Router } = require('express');
const { checkAuthStatus, register, login, me, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');

const router = Router();

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Demasiados intentos. Intenta nuevamente en 15 minutos.' });
const strictLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Demasiadas solicitudes. Intenta nuevamente en 15 minutos.' });

router.get('/status', checkAuthStatus);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', strictLimiter, forgotPassword);
router.post('/reset-password', strictLimiter, resetPassword);
router.get('/me', verifyToken, me);

module.exports = router;

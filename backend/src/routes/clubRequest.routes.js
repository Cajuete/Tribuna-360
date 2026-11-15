const { Router } = require('express');
const {
    registerClub,
    getClubRequests,
    getClubRequestStatus,
    resolveClubRequest
} = require('../controllers/clubRequest.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');

const router = Router();

router.post('/status', createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Demasiadas consultas. Intenta nuevamente más tarde.'
}), getClubRequestStatus);
router.post('/', createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Se alcanzó el límite de solicitudes. Intenta nuevamente más tarde.'
}), registerClub);
router.get('/', verifyToken, requireRole(['superadmin']), getClubRequests);
router.patch('/:id/decision', verifyToken, requireRole(['superadmin']), resolveClubRequest);

module.exports = router;

const { Router } = require('express');
const {
    getPlans,
    getMyMemberships,
    cancelMembership,
    getPendingCancellationRequests,
    resolveCancellationRequest,
    getMemberships,
    createPlan,
    updatePlan,
    deletePlan
} = require('../controllers/membership.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/plans', optionalAuth, getPlans);
router.post('/plans', verifyToken, requireRole(['superadmin', 'club_admin']), createPlan);
router.patch('/plans/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updatePlan);
router.delete('/plans/:id', verifyToken, requireRole(['superadmin', 'club_admin']), deletePlan);
router.post('/', verifyToken, (_req, res) => res.status(410).json({
    status: 'error',
    message: 'La suscripción directa con pago simulado fue desactivada. Usa el checkout de Tribuna 360.',
}));
router.get('/mine', verifyToken, getMyMemberships);
router.get('/cancellation-requests', verifyToken, requireRole(['superadmin', 'club_admin']), getPendingCancellationRequests);
router.patch('/cancellation-requests/:id/decision', verifyToken, requireRole(['superadmin', 'club_admin']), resolveCancellationRequest);
router.patch('/:id/renew', verifyToken, (_req, res) => res.status(410).json({
    status: 'error',
    message: 'La renovación directa con pago simulado fue desactivada. Usa el checkout de Tribuna 360.',
}));
router.patch('/:id/cancel', verifyToken, cancelMembership);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'financial_auditor', 'customer_support']), getMemberships);

module.exports = router;

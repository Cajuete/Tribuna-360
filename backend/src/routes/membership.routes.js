const { Router } = require('express');
const { getPlans, subscribe, getMyMemberships, cancelMembership, renewMembership, getMemberships, createPlan, updatePlan, deletePlan } = require('../controllers/membership.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/plans', optionalAuth, getPlans);
router.post('/plans', verifyToken, requireRole(['superadmin', 'club_admin']), createPlan);
router.patch('/plans/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updatePlan);
router.delete('/plans/:id', verifyToken, requireRole(['superadmin', 'club_admin']), deletePlan);
router.post('/', verifyToken, subscribe);
router.get('/mine', verifyToken, getMyMemberships);
router.patch('/:id/renew', verifyToken, requireRole(['superadmin', 'club_admin']), renewMembership);
router.patch('/:id/cancel', verifyToken, cancelMembership);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'financial_auditor', 'customer_support']), getMemberships);

module.exports = router;

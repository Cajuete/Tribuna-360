const { Router } = require('express');
const { getOverview, getSettings, updateSettings } = require('../controllers/saas.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/overview', verifyToken, requireRole(['superadmin']), getOverview);
router.get('/settings', verifyToken, requireRole(['superadmin']), getSettings);
router.put('/settings', verifyToken, requireRole(['superadmin']), updateSettings);

module.exports = router;
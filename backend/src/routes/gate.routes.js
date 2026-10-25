const { Router } = require('express');
const { getStadiumGates, updateGateStatus } = require('../controllers/gate.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'stadium_manager']), getStadiumGates);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'stadium_manager']), updateGateStatus);

module.exports = router;

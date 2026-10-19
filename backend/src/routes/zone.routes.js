const { Router } = require('express');
const { createZone, updateZone, deleteZone } = require('../controllers/zone.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/:matchId', verifyToken, requireRole(['superadmin', 'club_admin']), createZone);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updateZone);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), deleteZone);

module.exports = router;

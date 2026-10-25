const { Router } = require('express');
const { getMatches, createMatch, updateMatch, deleteMatch, getMatchById, getMatchZones } = require('../controllers/match.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', optionalAuth, getMatches);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin', 'stadium_manager']), createMatch);

router.get('/:id/zones', optionalAuth, getMatchZones);
router.get('/:id', optionalAuth, getMatchById);
router.put('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'stadium_manager']), updateMatch);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'stadium_manager']), deleteMatch);

module.exports = router;
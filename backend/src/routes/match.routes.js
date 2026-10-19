const { Router } = require('express');
const { getMatches, createMatch, updateMatch, deleteMatch, getMatchById, getMatchZones } = require('../controllers/match.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.get('/', getMatches);
router.post('/', verifyToken, requireRole(['superadmin', 'club_admin']), createMatch);

router.get('/:id/zones', getMatchZones);
router.get('/:id', getMatchById);
router.put('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), updateMatch);
router.delete('/:id', verifyToken, requireRole(['superadmin', 'club_admin']), deleteMatch);

module.exports = router;
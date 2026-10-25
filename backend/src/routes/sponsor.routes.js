const { Router } = require('express');
const { getSponsors, createSponsor, updateSponsor, deleteSponsor } = require('../controllers/sponsor.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
const roles = ['superadmin', 'club_admin', 'sales_manager'];

router.get('/', verifyToken, requireRole(roles), getSponsors);
router.post('/', verifyToken, requireRole(roles), createSponsor);
router.put('/:id', verifyToken, requireRole(roles), updateSponsor);
router.delete('/:id', verifyToken, requireRole(roles), deleteSponsor);

module.exports = router;
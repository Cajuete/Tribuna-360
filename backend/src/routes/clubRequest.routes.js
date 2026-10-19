const { Router } = require('express');
const { registerClub, getClubRequests } = require('../controllers/clubRequest.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

router.post('/', registerClub);
router.get('/', verifyToken, requireRole(['superadmin']), getClubRequests);

module.exports = router;

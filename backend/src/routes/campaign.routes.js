const { Router } = require('express');
const {
    getCampaigns,
    getPublicCampaigns,
    saveCampaign,
    setCampaignActive,
    deleteCampaign,
} = require('../controllers/campaign.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
const managerRoles = ['superadmin', 'club_admin', 'sales_manager'];

router.get('/public', getPublicCampaigns);
router.get('/', verifyToken, requireRole(managerRoles), getCampaigns);
router.post('/', verifyToken, requireRole(managerRoles), saveCampaign);
router.put('/:id', verifyToken, requireRole(managerRoles), saveCampaign);
router.patch('/:id/active', verifyToken, requireRole(managerRoles), setCampaignActive);
router.delete('/:id', verifyToken, requireRole(managerRoles), deleteCampaign);

module.exports = router;

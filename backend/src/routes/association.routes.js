const { Router } = require('express');
const { getAssociations } = require('../controllers/association.controller');

const router = Router();

router.get('/', getAssociations);

module.exports = router;

const { Router } = require('express');
const { checkAuthStatus } = require('../controllers/auth.controller');

const router = Router();

router.get('/status', checkAuthStatus);

module.exports = router;
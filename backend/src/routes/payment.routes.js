const { Router } = require('express');
const multer = require('multer');
const {
    createPayment,
    getSettings,
    updateSettings,
    uploadQr,
    listMine,
    listPayments,
    getPayment,
    submitProof,
    resolvePayment,
} = require('../controllers/payment.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
const proofTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const qrTypes = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowed = req.path.endsWith('/settings/qr') ? qrTypes : proofTypes;
        if (allowed.includes(file.mimetype)) return callback(null, true);
        const error = new Error('Formato de archivo no permitido.');
        error.code = 'INVALID_FILE_TYPE';
        callback(error);
    },
});
const singleFile = (field) => (req, res, next) => {
    upload.single(field)(req, res, error => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'El archivo supera el límite permitido.'
            : error.code === 'INVALID_FILE_TYPE'
                ? error.message
                : 'No se pudo procesar el archivo.';
        return res.status(400).json({ success: false, message });
    });
};

router.post('/', verifyToken, createPayment);
router.get('/mine', verifyToken, listMine);
router.get('/settings/:tenantId', verifyToken, getSettings);
router.patch('/settings', verifyToken, requireRole(['superadmin', 'club_admin']), updateSettings);
router.post('/settings/qr', verifyToken, requireRole(['superadmin', 'club_admin']), singleFile('qr'), uploadQr);
router.get('/', verifyToken, listPayments);
router.get('/:id', verifyToken, getPayment);
router.post('/:id/proof', verifyToken, singleFile('proof'), submitProof);
router.post('/:id/review', verifyToken, requireRole(['superadmin', 'club_admin', 'payment_manager']), resolvePayment);

module.exports = router;

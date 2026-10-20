const { Router } = require('express');
const multer = require('multer');
const { uploadClubLogo, uploadProductImage } = require('../controllers/upload.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
        const error = new Error('Formato no permitido. Usa PNG, JPG o WEBP.');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
    },
});

const singleFile = (field) => (req, res, next) => {
    upload.single(field)(req, res, err => {
        if (!err) return next();

        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen supera el máximo de 2 MB.'
            : err.code === 'INVALID_FILE_TYPE'
                ? err.message
                : 'No se pudo procesar la imagen.';

        return res.status(400).json({ status: 'error', message });
    });
};

router.post('/logo', singleFile('logo'), uploadClubLogo);
router.post('/product', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager']), singleFile('image'), uploadProductImage);

module.exports = router;

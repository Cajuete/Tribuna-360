const { Router } = require('express');
const multer = require('multer');
const { getMyOrders, getOrders, updateOrderStatus, markOrderDelivered } = require('../controllers/order.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

const router = Router();
const deliveryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(null, true);
        const error = new Error('Adjunta una foto JPG, PNG o WEBP.');
        error.code = 'INVALID_FILE_TYPE';
        callback(error);
    },
});
const singleDeliveryProof = (req, res, next) => {
    deliveryUpload.single('proof')(req, res, error => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE'
            ? 'La foto no puede superar 5 MB.'
            : error.code === 'INVALID_FILE_TYPE'
                ? error.message
                : 'No se pudo procesar la foto.';
        return res.status(400).json({ success: false, message });
    });
};

router.post('/', verifyToken, (_req, res) => res.status(410).json({
    success: false,
    message: 'El pago simulado fue desactivado. Inicia la compra mediante el checkout de Tribuna 360.',
}));
router.get('/mine', verifyToken, getMyOrders);
router.get('/', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'financial_auditor', 'customer_support', 'delivery_manager']), getOrders);
router.post('/:id/deliver', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'delivery_manager']), singleDeliveryProof, markOrderDelivered);
router.patch('/:id', verifyToken, requireRole(['superadmin', 'club_admin', 'sales_manager', 'delivery_manager']), updateOrderStatus);

module.exports = router;

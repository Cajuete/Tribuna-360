const { randomUUID } = require('crypto');
const { supabase } = require('../config/supabase');

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const BUCKETS = { club: 'club-logos', product: 'product-images', match: 'match-images' };

const readyBuckets = new Set();

const ensureBucket = async (bucket) => {
    if (readyBuckets.has(bucket)) return;

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = (buckets || []).some(b => b.name === bucket);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(bucket, { public: true });
        if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    }

    readyBuckets.add(bucket);
};

const uploadImage = async (req, res, { bucket, label }) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: `Selecciona una imagen para ${label}.` });
        }

        if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
            return res.status(400).json({ status: 'error', message: 'Formato no permitido. Usa PNG, JPG o WEBP.' });
        }

        await ensureBucket(bucket);

        const path = `${Date.now()}-${randomUUID()}.${EXTENSIONS[req.file.mimetype]}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);

        return res.status(201).json({
            status: 'success',
            message: `${label.charAt(0).toUpperCase() + label.slice(1)} subida correctamente.`,
            data: { url: data.publicUrl },
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: `No se pudo subir ${label}. Intenta nuevamente.`,
            error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message),
        });
    }
};

const uploadClubLogo = (req, res) => uploadImage(req, res, { bucket: BUCKETS.club, label: 'el escudo' });
const uploadProductImage = (req, res) => uploadImage(req, res, { bucket: BUCKETS.product, label: 'la imagen del producto' });
const uploadMatchImage = (req, res) => uploadImage(req, res, { bucket: BUCKETS.match, label: 'la imagen del partido' });

module.exports = { uploadClubLogo, uploadProductImage, uploadMatchImage };

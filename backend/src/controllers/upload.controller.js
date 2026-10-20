const { randomUUID } = require('crypto');
const { supabase } = require('../config/supabase');

const BUCKET = 'club-logos';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

let bucketReady = false;

const ensureBucket = async () => {
    if (bucketReady) return;

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = (buckets || []).some(b => b.name === BUCKET);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    }

    bucketReady = true;
};

const uploadClubLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'error', message: 'Selecciona una imagen para el escudo.' });
        }

        if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
            return res.status(400).json({ status: 'error', message: 'Formato no permitido. Usa PNG, JPG o WEBP.' });
        }

        await ensureBucket();

        const path = `${Date.now()}-${randomUUID()}.${EXTENSIONS[req.file.mimetype]}`;

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

        return res.status(201).json({
            status: 'success',
            message: 'Escudo subido correctamente.',
            data: { url: data.publicUrl },
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: 'No se pudo subir el escudo. Intenta nuevamente.',
            error: error.message,
        });
    }
};

module.exports = { uploadClubLogo };

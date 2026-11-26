const { supabase } = require('../config/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const tenantFilter = (req, query) => {
    if (req.user.role === 'superadmin') {
        if (req.query.tenant_id) query = query.eq('tenant_id', req.query.tenant_id);
        return query;
    }
    return query.eq('tenant_id', req.user.tenant_id);
};

const validatePackageItems = async (items, tenantId) => {
    if (!Array.isArray(items) || items.length > 30) return { error: 'Selecciona productos válidos para el paquete.' };
    const productIds = items.map(item => String(item?.product_id || '').toLowerCase());
    if (productIds.some(id => !UUID_RE.test(id)) || new Set(productIds).size !== productIds.length ||
        items.some(item => !Number.isInteger(Number(item?.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 99)) {
        return { error: 'Selecciona productos distintos y cantidades entre 1 y 99.' };
    }

    if (productIds.length === 0) return { value: [] };
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, tenant_id')
        .in('id', productIds);
    if (error) throw error;
    const validProducts = products || [];
    if (validProducts.length !== productIds.length || validProducts.some(product => product.tenant_id !== tenantId)) {
        return { error: 'Uno o más productos no pertenecen a este club.' };
    }

    const productsById = new Map(validProducts.map(product => [product.id, product]));
    return {
        value: items.map(item => ({
            product_id: String(item.product_id).toLowerCase(),
            name: productsById.get(String(item.product_id).toLowerCase()).name,
            quantity: Number(item.quantity),
        })),
    };
};

const getPackages = async (req, res) => {
    try {
        let query = supabase.from('packages').select('*, tenants(name)').order('created_at', { ascending: false });
        query = tenantFilter(req, query);
        if (req.query.active === 'true') query = query.eq('active', true);
        const { data, error } = await query;
        if (error) throw error;
        return res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al obtener paquetes', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const createPackage = async (req, res) => {
    try {
        const { name, description, price, items, active, tenant_id } = req.body;
        const cleanName = typeof name === 'string' ? name.trim() : '';
        const cleanDescription = typeof description === 'string' ? description.trim() : '';
        const value = Number(price);
        if (!cleanName || cleanName.length > 150 || price === undefined || price === null ||
            !Number.isFinite(value) || value < 0 || cleanDescription.length > 500) {
            return res.status(400).json({ success: false, message: 'Nombre, precio o items del paquete no son válidos.' });
        }
        const tid = req.user.role === 'superadmin' ? (tenant_id || req.user.tenant_id) : req.user.tenant_id;
        if (!tid) return res.status(400).json({ success: false, message: 'tenant_id es requerido.' });
        const normalizedItems = await validatePackageItems(items === undefined ? [] : items, tid);
        if (normalizedItems.error) return res.status(400).json({ success: false, message: normalizedItems.error });

        const payload = {
            tenant_id: tid,
            name: cleanName,
            description: cleanDescription || null,
            price: Number(price),
            items: normalizedItems.value,
            active: active !== false
        };
        const { data, error } = await supabase.from('packages').insert([payload]).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(201).json({ success: true, message: 'Paquete creado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al crear el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('packages').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Paquete de otro club.' });
        }
        const patch = {};
        const allowed = ['name', 'description', 'price', 'items', 'active'];
        for (const key of allowed) {
            if (req.body[key] !== undefined) patch[key] = req.body[key];
        }
        if (patch.items !== undefined) {
            const normalizedItems = await validatePackageItems(patch.items, existing.tenant_id);
            if (normalizedItems.error) return res.status(400).json({ success: false, message: normalizedItems.error });
            patch.items = normalizedItems.value;
        }
        const { data, error } = await supabase.from('packages').update(patch).eq('id', id).select('*, tenants(name)').single();
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Paquete actualizado.', data });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al actualizar el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

const deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const { data: existing, error: findError } = await supabase.from('packages').select('id, tenant_id').eq('id', id).single();
        if (findError || !existing) return res.status(404).json({ success: false, message: 'Paquete no encontrado.' });
        if (req.user.role !== 'superadmin' && existing.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ success: false, message: 'Paquete de otro club.' });
        }
        const { error } = await supabase.from('packages').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true, message: 'Paquete eliminado.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Error al eliminar el paquete', error: (process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : error.message) });
    }
};

module.exports = { getPackages, createPackage, updatePackage, deletePackage };
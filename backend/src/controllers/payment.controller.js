const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const { isValidBolivianCi, isValidBolivianPhone } = require('../utils/bolivian-validation');
const { getTicketCapacity } = require('../utils/ticket-capacity');
const {
    isEnabled: isWaitingRoomEnabled,
    releasePurchaseAccess,
    verifyPurchaseAccess,
} = require('../services/virtualQueue.service');

const PAYMENT_BUCKET = 'payment-proofs';
const QR_BUCKET = 'tenant-payment-qr';
const REVIEW_ROLES = ['superadmin', 'club_admin', 'payment_manager'];
const READ_ROLES = [...REVIEW_ROLES, 'sales_manager', 'financial_auditor'];
const FILE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};
const QR_FILE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const DELIVERY_DEPARTMENTS = [
    'Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro',
    'Pando', 'Potosí', 'Santa Cruz', 'Tarija',
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const expireStalePayments = async () => {
    const { error } = await supabase.rpc('expire_manual_payments');
    if (error) throw error;
};

const createPayment = async (req, res) => {
    let queueAdmission = null;
    try {
        const { purchase_type, data, queue_token, idempotency_key } = req.body || {};
        if (!['ticket', 'store', 'membership', 'membership_renewal'].includes(purchase_type)) {
            return res.status(400).json({ success: false, message: 'Tipo de compra no válido.' });
        }
        if (typeof idempotency_key !== 'string' || idempotency_key.length < 8 || idempotency_key.length > 100) {
            return res.status(400).json({ success: false, message: 'Identificador de compra no válido. Intenta nuevamente.' });
        }

        const purchaseData = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
        if (purchaseData.promo_code !== undefined) {
            if (!['ticket', 'store'].includes(purchase_type) ||
                typeof purchaseData.promo_code !== 'string' ||
                purchaseData.promo_code.trim().length > 50) {
                return res.status(400).json({ success: false, message: 'El código promocional no es válido para esta compra.' });
            }
            purchaseData.promo_code = purchaseData.promo_code.trim().toUpperCase();
            if (!purchaseData.promo_code) delete purchaseData.promo_code;
        }
        if (purchase_type === 'ticket') {
            const quantity = Number(purchaseData.quantity);
            if (!UUID_RE.test(String(purchaseData.match_id || '')) || !UUID_RE.test(String(purchaseData.zone_id || '')) ||
                !Number.isSafeInteger(quantity) || quantity < 1) {
                return res.status(400).json({ success: false, message: 'Selecciona un partido, una zona y una cantidad válida de entradas.' });
            }
            purchaseData.match_id = String(purchaseData.match_id);
            purchaseData.zone_id = String(purchaseData.zone_id);
            purchaseData.quantity = quantity;
            const { zone, available } = await getTicketCapacity(purchaseData.match_id, purchaseData.zone_id);
            if (!zone) return res.status(404).json({ success: false, message: 'La zona no pertenece a este partido.' });
            if (!zone.is_enabled) return res.status(409).json({ success: false, message: 'Esta zona no está habilitada para la venta.' });
            if (zone.sale_mode === 'numbered') {
                return res.status(409).json({ success: false, message: 'Esta zona requiere selección de butacas y aún no está habilitada para la venta.' });
            }
            if (quantity > available) {
                return res.status(409).json({ success: false, message: `Aforo insuficiente en esta zona: quedan ${available} entrada(s).` });
            }
            const buyerCi = purchaseData.buyer_ci === undefined || purchaseData.buyer_ci === null
                ? ''
                : String(purchaseData.buyer_ci).trim();
            if (purchaseData.buyer_ci !== undefined) {
                purchaseData.buyer_ci = buyerCi || null;
            }
            if (buyerCi) {
                if (!isValidBolivianCi(buyerCi)) {
                    return res.status(400).json({ success: false, message: 'El C.I. debe tener entre 6 y 8 digitos.' });
                }
                purchaseData.buyer_ci = buyerCi;
            }
        }
        if (purchase_type === 'store') {
            const items = purchaseData.items;
            if (!Array.isArray(items) || items.length < 1 || items.length > 10 ||
                items.some(item => !UUID_RE.test(String(item?.product_id || '')) ||
                    !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10)) {
                return res.status(400).json({ success: false, message: 'El carrito debe tener entre 1 y 10 productos y cantidades válidas.' });
            }
            purchaseData.items = items.map(item => ({
                product_id: String(item.product_id),
                quantity: Number(item.quantity),
            }));

            const rawDelivery = purchaseData.delivery;
            const text = (value, maxLength) => {
                if (value === undefined || value === null) return '';
                if (typeof value !== 'string') return null;
                const normalized = value.trim();
                return normalized.length <= maxLength ? normalized : null;
            };
            const recipientName = text(rawDelivery?.recipient_name, 120);
            const phone = text(rawDelivery?.phone, 30);
            const method = rawDelivery?.method;
            const city = text(rawDelivery?.city, 100);
            const department = rawDelivery?.department;
            const zone = text(rawDelivery?.zone, 100);
            const street = text(rawDelivery?.street, 160);
            const number = text(rawDelivery?.number, 30);
            const location = text(rawDelivery?.location, 240);
            const reference = text(rawDelivery?.reference, 250);
            if (
                !rawDelivery || typeof rawDelivery !== 'object' || Array.isArray(rawDelivery) ||
                [recipientName, phone, city, zone, street, number, location, reference].some(value => value === null) ||
                recipientName.length < 2 || !isValidBolivianPhone(phone) || !['home', 'point'].includes(method) ||
                !DELIVERY_DEPARTMENTS.includes(department) ||
                city.length < 2 ||
                (method === 'home' && (zone.length < 2 || street.length < 2)) ||
                (method === 'point' && location.length < 5)
            ) {
                return res.status(400).json({ success: false, message: 'Completa un nombre y una ubicación válidos; el celular debe tener 8 dígitos y comenzar con 5, 6 o 7.' });
            }
            purchaseData.delivery = {
                recipient_name: recipientName,
                phone,
                method,
                city,
                department,
                zone: method === 'home' ? zone : '',
                street: method === 'home' ? street : '',
                number: method === 'home' ? number : '',
                location: method === 'point' ? location : '',
                reference,
                fee_status: 'to_quote',
            };
        }
        if (purchase_type === 'membership') {
            if (!UUID_RE.test(String(purchaseData.plan_id || ''))) {
                return res.status(400).json({ success: false, message: 'Selecciona un plan de membresía válido.' });
            }
            purchaseData.plan_id = String(purchaseData.plan_id);
        }
        if (purchase_type === 'membership_renewal') {
            if (!UUID_RE.test(String(purchaseData.membership_id || ''))) {
                return res.status(400).json({ success: false, message: 'Selecciona una membresía válida para renovar.' });
            }
            purchaseData.membership_id = String(purchaseData.membership_id);
        }
        if (purchase_type === 'ticket' && isWaitingRoomEnabled()) {
            let queueAccess;
            try {
                queueAccess = await verifyPurchaseAccess({
                    token: queue_token,
                    matchId: purchaseData.match_id,
                    userId: String(req.user.id),
                });
            } catch (error) {
                console.error('[Payments] No se pudo validar la fila virtual:', error.message);
                return res.status(503).json({ success: false, message: 'No se pudo validar tu turno. Intenta más tarde.' });
            }
            if (!queueAccess.ok) {
                return res.status(403).json({ success: false, message: queueAccess.reason });
            }
            queueAdmission = { matchId: purchaseData.match_id, userId: String(req.user.id) };
        }

        const ticketCodes = purchase_type === 'ticket'
            ? Array.from({ length: Number.parseInt(purchaseData.quantity, 10) || 0 }, () => ({
                qr_code: `TRIBUNA360-${crypto.randomBytes(12).toString('hex').toUpperCase()}`,
            }))
            : [];
        const rpcPurchaseData = { ...purchaseData };
        const delivery = purchase_type === 'store' ? rpcPurchaseData.delivery : null;
        delete rpcPurchaseData.delivery;
        const { data: result, error } = await supabase.rpc('create_manual_payment_with_delivery', {
            p_user_id: req.user.id,
            p_purchase_type: purchase_type,
            p_data: rpcPurchaseData,
            p_ticket_codes: ticketCodes,
            p_idempotency_key: idempotency_key,
            p_delivery: delivery,
        });

        if (error) {
            const message = error.message || '';
            const validationErrors = {
                INVALID_PAYMENT_REQUEST: [400, 'Solicitud de pago no válida.'],
                INVALID_TICKET_COUNT: [400, 'La cantidad de entradas no es válida.'],
                MATCH_NOT_FOUND: [404, 'Partido no encontrado.'],
                ZONE_NOT_FOUND: [404, 'La zona no pertenece a este partido.'],
                ZONE_DISABLED: [409, 'Esta zona no está habilitada para la venta.'],
                NUMBERED_ZONE_REQUIRES_SEAT_SELECTION: [409, 'Esta zona requiere selección de butacas y aún no está habilitada para la venta.'],
                INSUFFICIENT_CAPACITY: [409, 'Ya no hay aforo suficiente para esta compra.'],
                INVALID_ORDER_ITEMS: [400, 'El carrito debe tener entre 1 y 10 productos.'],
                INVALID_ORDER_QUANTITY: [400, 'La cantidad de un producto no es válida.'],
                INVALID_DELIVERY_DETAILS: [400, 'Completa los datos de entrega antes de continuar.'],
                DELIVERY_DEPARTMENT_NOT_CONFIGURED: [409, 'El club debe configurar primero el departamento de origen para los envíos.'],
                PRODUCT_NOT_FOUND: [404, 'Uno de los productos ya no está disponible.'],
                CROSS_TENANT_CART_NOT_ALLOWED: [400, 'El carrito debe incluir productos de un solo club.'],
                INSUFFICIENT_STOCK: [409, 'No hay stock suficiente para completar el carrito.'],
                PROMOTION_CODE_INVALID: [400, 'El código no existe, no está vigente o fue desactivado.'],
                PROMOTION_CODE_LIMIT_REACHED: [409, 'Este código alcanzó su límite de usos.'],
                PROMOTION_CODE_NOT_APPLICABLE: [400, 'Este código no aplica a este tipo de compra.'],
                PROMOTION_CODE_ZERO_TOTAL: [400, 'El descuento no puede dejar el pago en cero. Usa un código de menor valor.'],
                PROMOTION_MEMBERS_ONLY: [403, 'Este código es exclusivo para socios con membresía vigente de este club.'],
                PROMOTION_ZONE_RESTRICTED: [400, 'Este código no aplica a la zona seleccionada.'],
                PROMOTION_CODE_NO_DISCOUNT: [400, 'Este código no genera un descuento para esta compra.'],
                PROMOTION_PAYMENT_NOT_ACTIVE: [409, 'No se puede aplicar el código a un pago que ya no está pendiente.'],
                PROMOTION_ALREADY_APPLIED: [409, 'Este pago ya tiene otro código promocional aplicado.'],
                PLAN_NOT_FOUND: [404, 'Plan de membresía no encontrado.'],
                ACTIVE_MEMBERSHIP_EXISTS: [409, 'Ya tienes una membresía activa en este club.'],
                MEMBERSHIP_PAYMENT_PENDING: [409, 'Ya tienes un pago de membresía pendiente de confirmación en este club.'],
                MEMBERSHIP_NOT_FOUND: [404, 'No se encontró una membresía renovable.'],
                CANCELLATION_PENDING: [409, 'No puedes renovar mientras haya una solicitud de cancelación pendiente.'],
                INVALID_PURCHASE_TYPE: [400, 'Tipo de compra no válido.'],
                INVALID_PAYMENT_AMOUNT: [400, 'El monto de la compra no es válido.'],
                QR_NOT_CONFIGURED: [409, 'El club todavía no configuró su QR de pagos. Intenta más tarde o contacta al club.'],
            };
            const matched = Object.entries(validationErrors).find(([key]) => message.includes(key));
            if (matched) return res.status(matched[1][0]).json({ success: false, message: matched[1][1] });
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: 'Compra iniciada. Paga con el QR del club y envía el comprobante para revisión.',
            data: result,
        });
    } catch (error) {
        console.error('[Payments] No se pudo iniciar el pago:', error.message);
        return res.status(500).json({
            success: false,
            message: 'No se pudo iniciar el pago. Intenta nuevamente.',
        });
    } finally {
        if (queueAdmission) {
            try {
                await releasePurchaseAccess(queueAdmission);
            } catch (error) {
                console.error('[WaitingRoom] No se pudo liberar el turno de compra:', error.message);
            }
        }
    }
};

const getSettings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tenant_payment_settings')
            .select('tenant_id, qr_image_url, account_name, payment_instructions')
            .eq('tenant_id', req.params.tenantId)
            .maybeSingle();
        if (error) throw error;
        return res.json({
            success: true,
            data: {
                ...(data || { tenant_id: req.params.tenantId, qr_image_url: null, account_name: null, payment_instructions: null }),
                card_available: false,
            },
        });
    } catch (error) {
        console.error('[Payments] No se pudo obtener la configuración QR:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo obtener el QR de pago del club.' });
    }
};

const updateSettings = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin' && req.user.role !== 'payment_manager') {
            return res.status(403).json({ success: false, message: 'Solo el encargado de pagos puede configurar el QR.' });
        }
        const { account_name, payment_instructions } = req.body || {};
        const accountName = typeof account_name === 'string' ? account_name.trim() : '';
        const instructions = typeof payment_instructions === 'string' ? payment_instructions.trim() : '';
        const tenantId = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenant_id;
        if (!tenantId || (req.user.role !== 'superadmin' && tenantId !== req.user.tenant_id)) {
            return res.status(400).json({ success: false, message: 'No se pudo determinar el club de la configuración.' });
        }
        if (accountName.length > 160 || instructions.length > 1000) {
            return res.status(400).json({ success: false, message: 'El nombre de cuenta o las instrucciones son demasiado largos.' });
        }
        const { data: existing, error: existingError } = await supabase
            .from('tenant_payment_settings')
            .select('qr_image_url')
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (existingError) throw existingError;

        const { data, error } = await supabase
            .from('tenant_payment_settings')
            .upsert({
                tenant_id: tenantId,
                qr_image_url: existing?.qr_image_url || null,
                account_name: accountName || null,
                payment_instructions: instructions || null,
                updated_at: new Date().toISOString(),
            })
            .select('tenant_id, qr_image_url, account_name, payment_instructions')
            .single();
        if (error) throw error;
        return res.json({ success: true, message: 'Configuración de pagos guardada.', data });
    } catch (error) {
        console.error('[Payments] No se pudo actualizar la configuración:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo guardar la configuración de pagos.' });
    }
};

const uploadQr = async (req, res) => {
    let uploadedPath = null;
    try {
        if (req.user.role !== 'superadmin' && req.user.role !== 'payment_manager') {
            return res.status(403).json({ success: false, message: 'Solo el encargado de pagos puede configurar el QR.' });
        }
        if (!req.file || !QR_FILE_TYPES[req.file.mimetype]) {
            return res.status(400).json({ success: false, message: 'Selecciona una imagen PNG, JPG o WEBP del QR.' });
        }
        if (req.file.size > 2 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'La imagen del QR no puede superar 2 MB.' });
        }

        const tenantId = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenant_id;
        if (!tenantId || (req.user.role !== 'superadmin' && tenantId !== req.user.tenant_id)) {
            return res.status(400).json({ success: false, message: 'No se pudo determinar el club del QR.' });
        }
        uploadedPath = `${tenantId}/${crypto.randomUUID()}.${QR_FILE_TYPES[req.file.mimetype]}`;
        const { error: uploadError } = await supabase.storage
            .from(QR_BUCKET)
            .upload(uploadedPath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage.from(QR_BUCKET).getPublicUrl(uploadedPath);
        const { data, error } = await supabase
            .from('tenant_payment_settings')
            .upsert({ tenant_id: tenantId, qr_image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
            .select('tenant_id, qr_image_url, account_name, payment_instructions')
            .single();
        if (error) throw error;
        return res.status(201).json({ success: true, message: 'QR del club actualizado.', data });
    } catch (error) {
        if (uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(QR_BUCKET).remove([uploadedPath]);
            if (cleanupError) console.error('[Payments] No se pudo limpiar el QR no vinculado:', cleanupError.message);
        }
        console.error('[Payments] No se pudo subir el QR:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo subir el QR del club.' });
    }
};

const signProof = async (payment) => {
    if (!payment.proof_path) return { ...payment, proof_url: null };
    const { data, error } = await supabase.storage
        .from(PAYMENT_BUCKET)
        .createSignedUrl(payment.proof_path, 10 * 60);
    if (error) throw error;
    return { ...payment, proof_url: data.signedUrl };
};

const hideDeliveryFromUnauthorizedStaff = (payment, user) => {
    if (
        payment.user_id === user.id ||
        ['superadmin', 'club_admin', 'sales_manager'].includes(user.role) ||
        !payment.purchase_data?.delivery
    ) {
        return payment;
    }
    const { delivery, ...purchaseData } = payment.purchase_data;
    return { ...payment, purchase_data: purchaseData };
};

const listMine = async (req, res) => {
    try {
        await expireStalePayments();
        const { data, error } = await supabase
            .from('payments')
            .select('id, tenant_id, purchase_type, payment_method, amount, currency, status, purchase_data, proof_path, buyer_note, review_note, reviewed_at, expires_at, created_at, tenants(name)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        const signed = await Promise.all((data || []).map(signProof));
        return res.json({ success: true, data: signed });
    } catch (error) {
        console.error('[Payments] No se pudieron obtener los pagos del usuario:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudieron cargar tus pagos.' });
    }
};

const listPayments = async (req, res) => {
    try {
        if (!READ_ROLES.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para consultar la bandeja de pagos.' });
        }
        await expireStalePayments();
        let query = supabase
            .from('payments')
            .select('id, user_id, tenant_id, purchase_type, payment_method, amount, currency, status, purchase_data, proof_path, buyer_note, review_note, reviewed_at, expires_at, created_at, users!user_id(email, full_name), tenants(name)')
            .order('created_at', { ascending: false })
            .limit(200);
        if (req.user.role !== 'superadmin') query = query.eq('tenant_id', req.user.tenant_id);
        if (req.query.status && ['awaiting_proof', 'pending_review', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) {
            query = query.eq('status', req.query.status);
        }
        const { data, error } = await query;
        if (error) throw error;
        const signed = await Promise.all((data || [])
            .map(payment => hideDeliveryFromUnauthorizedStaff(payment, req.user))
            .map(signProof));
        return res.json({ success: true, data: signed });
    } catch (error) {
        console.error('[Payments] No se pudo cargar la bandeja:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo cargar la bandeja de pagos.' });
    }
};

const getPayment = async (req, res) => {
    try {
        const { data: initialPayment, error: initialError } = await supabase
            .from('payments')
            .select('id, user_id, tenant_id, purchase_type, payment_method, amount, currency, status, purchase_data, proof_path, buyer_note, review_note, reviewed_at, expires_at, created_at, users!user_id(email, full_name), tenants(name)')
            .eq('id', req.params.id)
            .maybeSingle();
        if (initialError) throw initialError;
        if (!initialPayment) return res.status(404).json({ success: false, message: 'Pago no encontrado.' });

        const isReviewer = READ_ROLES.includes(req.user.role) &&
            (req.user.role === 'superadmin' || req.user.tenant_id === initialPayment.tenant_id);
        if (initialPayment.user_id !== req.user.id && !isReviewer) {
            return res.status(403).json({ success: false, message: 'No tienes acceso a este pago.' });
        }
        await expireStalePayments();
        const { data, error } = await supabase
            .from('payments')
            .select('id, user_id, tenant_id, purchase_type, payment_method, amount, currency, status, purchase_data, proof_path, buyer_note, review_note, reviewed_at, expires_at, created_at, users!user_id(email, full_name), tenants(name)')
            .eq('id', req.params.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ success: false, message: 'Pago no encontrado.' });
        const payment = await signProof(hideDeliveryFromUnauthorizedStaff(data, req.user));
        const { data: settings, error: settingsError } = await supabase
            .from('tenant_payment_settings')
            .select('tenant_id, qr_image_url, account_name, payment_instructions')
            .eq('tenant_id', data.tenant_id)
            .maybeSingle();
        if (settingsError) throw settingsError;
        return res.json({
            success: true,
            data: { ...payment, payment_settings: settings || null, card_available: false },
        });
    } catch (error) {
        console.error('[Payments] No se pudo cargar el pago:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo cargar el pago.' });
    }
};

const submitProof = async (req, res) => {
    let uploadedPath = null;
    try {
        if (!req.file || !FILE_TYPES[req.file.mimetype]) {
            return res.status(400).json({ success: false, message: 'Adjunta una imagen o PDF del comprobante.' });
        }
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'El comprobante no puede superar 5 MB.' });
        }
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('id, tenant_id, status')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .maybeSingle();
        if (paymentError) throw paymentError;
        if (!payment) return res.status(404).json({ success: false, message: 'Pago no encontrado.' });
        if (payment.status !== 'awaiting_proof') {
            return res.status(409).json({ success: false, message: 'Este pago ya fue enviado o resuelto.' });
        }
        const note = typeof req.body?.buyer_note === 'string' ? req.body.buyer_note.trim() : '';
        if (note.length > 500) return res.status(400).json({ success: false, message: 'La nota no puede superar 500 caracteres.' });

        uploadedPath = `${payment.tenant_id}/${req.user.id}/${payment.id}-${crypto.randomUUID()}.${FILE_TYPES[req.file.mimetype]}`;
        const { error: uploadError } = await supabase.storage
            .from(PAYMENT_BUCKET)
            .upload(uploadedPath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) throw uploadError;

        const { data, error } = await supabase.rpc('submit_payment_proof', {
            p_payment_id: payment.id,
            p_user_id: req.user.id,
            p_proof_path: uploadedPath,
            p_buyer_note: note,
        });
        if (error) {
            const message = error.message || '';
            let response = null;
            if (message.includes('PAYMENT_NOT_FOUND')) response = [404, 'Pago no encontrado.'];
            else if (message.includes('PAYMENT_NOT_AWAITING_PROOF')) response = [409, 'Este pago ya fue enviado o resuelto.'];
            else if (message.includes('PAYMENT_EXPIRED')) response = [409, 'El plazo para enviar el comprobante venció. Inicia una nueva compra.'];
            else if (message.includes('INVALID_PAYMENT_PROOF')) response = [400, 'El comprobante o la nota no son válidos.'];
            if (response) {
                const { error: cleanupError } = await supabase.storage.from(PAYMENT_BUCKET).remove([uploadedPath]);
                uploadedPath = null;
                if (cleanupError) console.error('[Payments] No se pudo limpiar un comprobante no vinculado:', cleanupError.message);
                return res.status(response[0]).json({ success: false, message: response[1] });
            }
            throw error;
        }
        return res.json({ success: true, message: 'Comprobante enviado. El club revisará el pago antes de habilitar tu compra.', data });
    } catch (error) {
        if (uploadedPath) {
            const { error: cleanupError } = await supabase.storage.from(PAYMENT_BUCKET).remove([uploadedPath]);
            if (cleanupError) console.error('[Payments] No se pudo limpiar un comprobante no vinculado:', cleanupError.message);
        }
        console.error('[Payments] No se pudo enviar el comprobante:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo enviar el comprobante. Intenta nuevamente.' });
    }
};

const resolvePayment = async (req, res) => {
    try {
        if (!REVIEW_ROLES.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para resolver pagos.' });
        }
        const { decision, review_note } = req.body || {};
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ success: false, message: 'La decisión debe ser approved o rejected.' });
        }
        const note = typeof review_note === 'string' ? review_note.trim() : '';
        if (note.length > 2000) return res.status(400).json({ success: false, message: 'La nota no puede superar 2000 caracteres.' });
        await expireStalePayments();
        const { data, error } = await supabase.rpc('resolve_manual_payment', {
            p_payment_id: req.params.id,
            p_decision: decision,
            p_review_note: note,
            p_reviewer_id: req.user.id,
        });
        if (error) {
            const message = error.message || '';
            const errors = {
                INVALID_DECISION: [400, 'La decisión no es válida.'],
                REVIEW_NOTE_TOO_LONG: [400, 'La nota es demasiado larga.'],
                PAYMENT_REVIEWER_REQUIRED: [403, 'No tienes permiso para resolver pagos.'],
                PAYMENT_OTHER_TENANT: [403, 'El pago pertenece a otro club.'],
                PAYMENT_NOT_FOUND: [404, 'Pago no encontrado.'],
                PAYMENT_ALREADY_RESOLVED: [409, 'Este pago ya fue enviado o resuelto.'],
                REJECTION_NOTE_REQUIRED: [400, 'Indica el motivo del rechazo.'],
                PAYMENT_TICKETS_NOT_FOUND: [409, 'No se encontraron las entradas reservadas para este pago.'],
                PAYMENT_ORDERS_NOT_FOUND: [409, 'No se encontraron los pedidos reservados para este pago.'],
                ACTIVE_MEMBERSHIP_EXISTS: [409, 'El usuario ya tiene una membresía activa; verifica el pago antes de resolverlo.'],
                MEMBERSHIP_NOT_FOUND: [409, 'La membresía que se intenta renovar ya no está activa.'],
                CANCELLATION_PENDING: [409, 'No se puede confirmar la renovación mientras la cancelación esté pendiente.'],
                PLAN_NOT_FOUND: [409, 'El plan asociado al pago ya no está disponible.'],
            };
            const matched = Object.entries(errors).find(([key]) => message.includes(key));
            if (matched) return res.status(matched[1][0]).json({ success: false, message: matched[1][1] });
            throw error;
        }
        return res.json({
            success: true,
            message: decision === 'approved'
                ? 'Pago confirmado. La compra ya está habilitada para el usuario.'
                : 'Pago rechazado. Se liberó la reserva de entradas o stock.',
            data,
        });
    } catch (error) {
        console.error('[Payments] No se pudo resolver el pago:', error.message);
        return res.status(500).json({ success: false, message: 'No se pudo resolver el pago.' });
    }
};

module.exports = {
    createPayment,
    getSettings,
    updateSettings,
    uploadQr,
    listMine,
    listPayments,
    getPayment,
    submitProof,
    resolvePayment,
};

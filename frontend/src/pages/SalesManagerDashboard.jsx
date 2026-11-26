import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { promotionService } from '../api/promotion.service';
import { packageService } from '../api/package.service';
import { productService } from '../api/product.service';
import { sponsorService } from '../api/sponsor.service';
import { uploadService } from '../api/upload.service';
import CampaignManager from '../components/CampaignManager';

const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white';
const labelCls = 'text-xs text-gray-400 block mb-1';

function getPromotionStatus(promotion) {
  const now = Date.now();
  if (!promotion.is_active) return { label: 'Pausada', className: 'bg-gray-700 text-gray-300' };
  if (promotion.max_uses !== null && Number(promotion.used_count) >= Number(promotion.max_uses)) {
    return { label: 'Agotada', className: 'bg-rose-900 text-rose-300' };
  }
  if (promotion.starts_at && Date.parse(promotion.starts_at) > now) {
    return { label: 'Programada', className: 'bg-sky-900 text-sky-300' };
  }
  if (promotion.ends_at && Date.parse(promotion.ends_at) <= now) {
    return { label: 'Vencida', className: 'bg-gray-700 text-gray-300' };
  }
  return { label: 'Vigente', className: 'bg-emerald-900 text-emerald-300' };
}

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <p className={`mb-3 p-3 rounded text-center ${msg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
      {msg.text}
    </p>
  );
}

export default function SalesManagerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('campañas');
  const [promotions, setPromotions] = useState([]);
  const [promoMsg, setPromoMsg] = useState(null);
  const [promoForm, setPromoForm] = useState({
    code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both',
    audience: 'all', zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true
  });
  const [editingPromoId, setEditingPromoId] = useState(null);
  const [packages, setPackages] = useState([]);
  const [packageProducts, setPackageProducts] = useState([]);
  const [packageMsg, setPackageMsg] = useState(null);
  const [packageForm, setPackageForm] = useState({ name: '', description: '', price: '', items: [], active: true });
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [sponsorMsg, setSponsorMsg] = useState(null);
  const [sponsorForm, setSponsorForm] = useState({ name: '', logo_url: '', link: '', position: 'home', active: true });
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [uploadingSponsorLogo, setUploadingSponsorLogo] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [metricsMsg, setMetricsMsg] = useState(null);
  const [tenantId, setTenantId] = useState(user?.tenant_id || '');
  const [formErrors, setFormErrors] = useState({});

  const isSuperadmin = user?.role === 'superadmin';

  const loadPromotions = useCallback(() => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    promotionService.getAll(qs)
      .then(res => { if (res.success) setPromotions(res.data); })
      .catch(err => setPromoMsg({ ok: false, text: err.message }));
  }, [isSuperadmin, tenantId]);

  const loadPackages = useCallback(() => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    packageService.getAll(qs)
      .then(res => { if (res.success) setPackages(res.data); })
      .catch(err => setPackageMsg({ ok: false, text: err.message }));
  }, [isSuperadmin, tenantId]);

  const loadPackageProducts = useCallback(() => {
    if (isSuperadmin && !tenantId) {
      setPackageProducts([]);
      return;
    }
    const qs = isSuperadmin ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
    productService.getAll(qs)
      .then(res => { if (res.success) setPackageProducts(res.data || []); })
      .catch(err => setPackageMsg({ ok: false, text: err.message }));
  }, [isSuperadmin, tenantId]);

  const loadSponsors = useCallback(() => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    sponsorService.getAll(qs)
      .then(res => { if (res.success) setSponsors(res.data); })
      .catch(err => setSponsorMsg({ ok: false, text: err.message }));
  }, [isSuperadmin, tenantId]);

  const loadMetrics = useCallback(() => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    promotionService.getMetrics(qs)
      .then(res => { if (res.success) setMetrics(res.data); })
      .catch(err => setMetricsMsg({ ok: false, text: err.message }));
  }, [isSuperadmin, tenantId]);

  useEffect(() => {
    loadPromotions();
    loadPackages();
    loadPackageProducts();
    loadSponsors();
    loadMetrics();
  }, [loadMetrics, loadPackages, loadPackageProducts, loadPromotions, loadSponsors]);

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    const value = Number(promoForm.discount_value);
    const maxUses = promoForm.max_uses === '' ? null : Number(promoForm.max_uses);
    const errors = {};
    if (!promoForm.code.trim()) errors.promo_code = 'Escribe un código.';
    else if (promoForm.code.trim().length > 50) errors.promo_code = 'Usa hasta 50 caracteres.';
    if (!Number.isFinite(value) || value <= 0 ||
      (promoForm.discount_type === 'percentage' && value >= 100)) {
      errors.promo_value = promoForm.discount_type === 'percentage'
        ? 'El porcentaje debe ser mayor que 0 y menor que 100.'
        : 'El monto debe ser mayor que 0.';
    }
    if (promoForm.description.length > 500) errors.promo_description = 'Usa hasta 500 caracteres.';
    if (promoForm.zone_name.length > 100) errors.promo_zone = 'Usa hasta 100 caracteres.';
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      errors.promo_max_uses = 'Los usos máximos deben ser un entero mayor o igual a 1.';
    }
    if (promoForm.starts_at && promoForm.ends_at &&
      new Date(promoForm.ends_at) <= new Date(promoForm.starts_at)) {
      errors.promo_dates = 'La fecha de fin debe ser posterior a la de inicio.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setPromoMsg({ ok: false, text: 'Revisa los campos marcados antes de guardar.' });
      return;
    }
    try {
      const payload = { ...promoForm, tenant_id: isSuperadmin ? tenantId : undefined };
      if (editingPromoId) {
        await promotionService.update(editingPromoId, payload);
        setPromoMsg({ ok: true, text: 'Promoción actualizada.' });
      } else {
        await promotionService.create(payload);
        setPromoMsg({ ok: true, text: 'Promoción creada.' });
      }
      setPromoForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both', audience: 'all', zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true });
      setEditingPromoId(null);
      loadPromotions();
    } catch (err) {
      setPromoMsg({ ok: false, text: err.message });
    }
  };

  const handlePromoEdit = (p) => {
    setEditingPromoId(p.id);
    setPromoForm({
      code: p.code || '',
      description: p.description || '',
      discount_type: p.discount_type || 'percentage',
      discount_value: p.discount_value ?? '',
      applies_to: p.applies_to || 'both',
      audience: p.audience || 'all',
      zone_name: p.zone_name || '',
      max_uses: p.max_uses ?? '',
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '',
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : '',
      is_active: p.is_active !== false
    });
  };

  const handlePromoDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta promoción?')) return;
    try {
      await promotionService.remove(id);
      setPromoMsg({ ok: true, text: 'Promoción eliminada.' });
      loadPromotions();
    } catch (err) {
      setPromoMsg({ ok: false, text: err.message });
    }
  };
  const handlePackageSubmit = async (e) => {
    e.preventDefault();
    const price = Number(packageForm.price);
    const errors = {};
    if (!packageForm.name.trim()) errors.package_name = 'Escribe el nombre del paquete.';
    else if (packageForm.name.trim().length > 150) errors.package_name = 'Usa hasta 150 caracteres.';
    if (!Number.isFinite(price) || price < 0) errors.package_price = 'El precio debe ser mayor o igual a 0.';
    if (packageForm.description.length > 500) errors.package_description = 'Usa hasta 500 caracteres.';
    const items = packageForm.items.map(item => {
      const product = packageProducts.find(candidate => candidate.id === item.product_id);
      return {
        product_id: item.product_id,
        name: product?.name || '',
        quantity: Number(item.quantity),
      };
    });
    if (items.some(item => !item.product_id || !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
      errors.package_items = 'Selecciona un producto y una cantidad entre 1 y 99 para cada artículo.';
    }
    if (new Set(items.map(item => item.product_id)).size !== items.length) {
      errors.package_items = 'Cada producto solo puede aparecer una vez en el paquete.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setPackageMsg({ ok: false, text: 'Revisa los campos marcados antes de guardar.' });
      return;
    }
    try {
      const payload = { ...packageForm, items, price: Number(packageForm.price), tenant_id: isSuperadmin ? tenantId : undefined };
      if (editingPackageId) {
        await packageService.update(editingPackageId, payload);
        setPackageMsg({ ok: true, text: 'Paquete actualizado.' });
      } else {
        await packageService.create(payload);
        setPackageMsg({ ok: true, text: 'Paquete creado.' });
      }
      setPackageForm({ name: '', description: '', price: '', items: [], active: true });
      setEditingPackageId(null);
      loadPackages();
    } catch (err) {
      setPackageMsg({ ok: false, text: err.message });
    }
  };

  const handlePackageEdit = (p) => {
    setEditingPackageId(p.id);
    setPackageForm({
      name: p.name || '',
      description: p.description || '',
      price: p.price ?? '',
      items: Array.isArray(p.items) ? p.items.map(item => {
        if (typeof item === 'string') return { name: item, quantity: '1' };
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return {
            product_id: String(item.product_id || ''),
            name: String(item.name || item.label || item.description || ''),
            quantity: String(item.quantity ?? 1),
          };
        }
        return { product_id: '', name: String(item ?? ''), quantity: '1' };
      }) : [],
      active: p.active !== false
    });
  };

  const updatePackageItem = (index, key, value) => {
    setPackageForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }));
  };

  const addPackageItem = () => {
    setPackageForm(current => ({
      ...current,
      items: [...current.items, { product_id: '', name: '', quantity: '1' }],
    }));
  };

  const handlePackageDelete = async (id) => {
    if (!window.confirm('¿Eliminar este paquete?')) return;
    try {
      await packageService.remove(id);
      setPackageMsg({ ok: true, text: 'Paquete eliminado.' });
      loadPackages();
    } catch (err) {
      setPackageMsg({ ok: false, text: err.message });
    }
  };

  const handleSponsorSubmit = async (e) => {
    e.preventDefault();
    if (uploadingSponsorLogo) {
      setSponsorMsg({ ok: false, text: 'Espera a que termine de subirse el logo.' });
      return;
    }
    const errors = {};
    if (!sponsorForm.name.trim()) errors.sponsor_name = 'Escribe el nombre del patrocinador.';
    else if (sponsorForm.name.trim().length > 150) errors.sponsor_name = 'Usa hasta 150 caracteres.';
    if (!sponsorForm.logo_url) errors.sponsor_logo = 'Sube el logo del patrocinador.';
    if (sponsorForm.link && !/^https?:\/\/[^\s]+$/i.test(sponsorForm.link.trim())) {
      errors.sponsor_link = 'Usa una URL válida que comience con http:// o https://.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setSponsorMsg({ ok: false, text: 'Revisa los campos marcados antes de guardar.' });
      return;
    }
    try {
      const payload = { ...sponsorForm, tenant_id: isSuperadmin ? tenantId : undefined };
      if (editingSponsorId) {
        await sponsorService.update(editingSponsorId, payload);
        setSponsorMsg({ ok: true, text: 'Patrocinador actualizado.' });
      } else {
        await sponsorService.create(payload);
        setSponsorMsg({ ok: true, text: 'Patrocinador creado.' });
      }
      setSponsorForm({ name: '', logo_url: '', link: '', position: 'home', active: true });
      setEditingSponsorId(null);
      loadSponsors();
    } catch (err) {
      setSponsorMsg({ ok: false, text: err.message });
    }
  };

  const handleSponsorLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setSponsorMsg({ ok: false, text: 'El logo debe ser PNG, JPG o WEBP y no superar 2 MB.' });
      event.target.value = '';
      return;
    }
    setUploadingSponsorLogo(true);
    setSponsorMsg(null);
    try {
      const response = await uploadService.sponsorLogo(file);
      setSponsorForm(current => ({ ...current, logo_url: response.data.url }));
      setSponsorMsg({ ok: true, text: 'Logo subido correctamente.' });
    } catch (err) {
      setSponsorMsg({ ok: false, text: err.message });
    } finally {
      setUploadingSponsorLogo(false);
      event.target.value = '';
    }
  };

  const handleSponsorEdit = (s) => {
    setEditingSponsorId(s.id);
    setSponsorForm({
      name: s.name || '',
      logo_url: s.logo_url || '',
      link: s.link || '',
      position: s.position || 'home',
      active: s.active !== false
    });
  };

  const handleSponsorDelete = async (id) => {
    if (!window.confirm('¿Eliminar este patrocinador?')) return;
    try {
      await sponsorService.remove(id);
      setSponsorMsg({ ok: true, text: 'Patrocinador eliminado.' });
      loadSponsors();
    } catch (err) {
      setSponsorMsg({ ok: false, text: err.message });
    }
  };


  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Panel Gerente de Ventas</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {['campañas', 'promociones', 'paquetes', 'patrocinadores', 'metricas'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === t ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
          >
            {t === 'campañas' ? 'Campañas' : t === 'promociones' ? 'Códigos promocionales' : t === 'paquetes' ? 'Paquetes' : t === 'patrocinadores' ? 'Patrocinadores' : 'Métricas de conversión'}
          </button>
        ))}
      </div>

      {isSuperadmin && (
        <div className="mb-4">
          <label className={labelCls}>Club (tenant_id)</label>
          <input className={inputCls} value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="UUID del club" />
        </div>
      )}

      {tab === 'campañas' && (
        <CampaignManager tenantId={tenantId} isSuperadmin={isSuperadmin} />
      )}
      {tab === 'promociones' && (
        <div className="space-y-6">
          <Notice msg={promoMsg} />
          <p className="text-sm text-gray-400">
            El hincha ingresa este código al comprar. Las campañas aplican sus descuentos automáticamente. El total debe conservar un monto para pagar por QR.
          </p>
          <form onSubmit={handlePromoSubmit} noValidate className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label>
              <span className={labelCls}>Código para compartir</span>
              <input id="promo_code" maxLength={50} aria-invalid={Boolean(formErrors.promo_code)} className={`${inputCls} uppercase ${formErrors.promo_code ? 'border-rose-500/60' : ''}`} value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} placeholder="Ej. HINCHA10" required />
              {formErrors.promo_code && <span className="text-xs text-rose-400 mt-1 block">{formErrors.promo_code}</span>}
            </label>
            <label>
              <span className={labelCls}>Tipo</span>
              <select className={inputCls} value={promoForm.discount_type} onChange={e => setPromoForm({ ...promoForm, discount_type: e.target.value })}>
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Monto fijo</option>
              </select>
            </label>
            <label>
              <span className={labelCls}>Valor</span>
              <input id="promo_value" type="number" min="0" max={promoForm.discount_type === 'percentage' ? 99.99 : undefined} step="0.01" aria-invalid={Boolean(formErrors.promo_value)} className={`${inputCls} ${formErrors.promo_value ? 'border-rose-500/60' : ''}`} value={promoForm.discount_value} onChange={e => setPromoForm({ ...promoForm, discount_value: e.target.value })} required />
              {formErrors.promo_value && <span className="text-xs text-rose-400 mt-1 block">{formErrors.promo_value}</span>}
            </label>
            <label>
              <span className={labelCls}>Aplica a</span>
              <select className={inputCls} value={promoForm.applies_to} onChange={e => setPromoForm({ ...promoForm, applies_to: e.target.value, zone_name: e.target.value === 'products' ? '' : promoForm.zone_name })}>
                <option value="both">Entradas y tienda</option>
                <option value="tickets">Entradas</option>
                <option value="products">Tienda</option>
              </select>
            </label>
            <label>
              <span className={labelCls}>Quién puede usarlo</span>
              <select className={inputCls} value={promoForm.audience} onChange={e => setPromoForm({ ...promoForm, audience: e.target.value })}>
                <option value="all">Cualquier hincha con el código</option>
                <option value="members">Solo socios con membresía vigente</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span className={labelCls}>Descripción</span>
              <input id="promo_description" maxLength={500} aria-invalid={Boolean(formErrors.promo_description)} className={`${inputCls} ${formErrors.promo_description ? 'border-rose-500/60' : ''}`} value={promoForm.description} onChange={e => setPromoForm({ ...promoForm, description: e.target.value })} />
              {formErrors.promo_description && <span className="text-xs text-rose-400 mt-1 block">{formErrors.promo_description}</span>}
            </label>
            <label>
              <span className={labelCls}>Zona de entradas (opcional)</span>
              <input id="promo_zone" maxLength={100} disabled={promoForm.applies_to === 'products'} aria-invalid={Boolean(formErrors.promo_zone)} className={`${inputCls} ${formErrors.promo_zone ? 'border-rose-500/60' : ''}`} value={promoForm.zone_name} onChange={e => setPromoForm({ ...promoForm, zone_name: e.target.value })} placeholder="General" />
              <span className="text-xs text-gray-400 mt-1 block">Si indicas una zona, el código solo sirve para entradas de esa zona.</span>
              {formErrors.promo_zone && <span className="text-xs text-rose-400 mt-1 block">{formErrors.promo_zone}</span>}
            </label>
            <label>
              <span className={labelCls}>Usos máximos</span>
              <input id="promo_max_uses" type="number" min="1" step="1" aria-invalid={Boolean(formErrors.promo_max_uses)} className={`${inputCls} ${formErrors.promo_max_uses ? 'border-rose-500/60' : ''}`} value={promoForm.max_uses} onChange={e => setPromoForm({ ...promoForm, max_uses: e.target.value })} />
              {formErrors.promo_max_uses && <span className="text-xs text-rose-400 mt-1 block">{formErrors.promo_max_uses}</span>}
            </label>
            <label>
              <span className={labelCls}>Válido desde</span>
              <input type="datetime-local" className={inputCls} value={promoForm.starts_at} onChange={e => setPromoForm({ ...promoForm, starts_at: e.target.value })} />
            </label>
            <label>
              <span className={labelCls}>Válido hasta</span>
              <input type="datetime-local" className={inputCls} value={promoForm.ends_at} onChange={e => setPromoForm({ ...promoForm, ends_at: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={promoForm.is_active} onChange={e => setPromoForm({ ...promoForm, is_active: e.target.checked })} />
              <span className="text-sm text-gray-300">Activa</span>
            </label>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">
              {editingPromoId ? 'Guardar cambios' : 'Crear promoción'}
            </button>
            {editingPromoId && (
              <button type="button" onClick={() => { setEditingPromoId(null); setPromoForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both', audience: 'all', zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
                Cancelar
              </button>
            )}
          </form>

          <div className="space-y-3">
            {promotions.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay promociones todavía.</p>}
            {promotions.map(p => (
              <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{p.code} <span className="text-gray-400 font-normal">({p.tenants?.name})</span></p>
                  <p className="text-gray-400 text-xs">
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `Bs ${p.discount_value}`} · {p.zone_name ? 'Entradas' : p.applies_to === 'both' ? 'Entradas y tienda' : p.applies_to === 'tickets' ? 'Entradas' : 'Tienda'}
                    {' · '}{p.audience === 'members' ? 'Solo socios vigentes' : 'Todos con el código'}
                    {p.zone_name ? ` · ${p.zone_name}` : ''}
                    {p.max_uses ? ` · usos ${p.used_count || 0}/${p.max_uses}` : ''}
                  </p>
                  {p.description && <p className="text-gray-400 text-xs mt-1">{p.description}</p>}
                  {(p.starts_at || p.ends_at) && (
                    <p className="text-gray-500 text-xs mt-1">
                      Vigencia: {p.starts_at ? new Date(p.starts_at).toLocaleString('es-BO') : 'inmediata'}
                      {' – '}{p.ends_at ? new Date(p.ends_at).toLocaleString('es-BO') : 'sin fecha de fin'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const status = getPromotionStatus(p);
                    return <span className={`text-xs px-3 py-1 rounded-full ${status.className}`}>{status.label}</span>;
                  })()}
                  <button type="button" onClick={() => handlePromoEdit(p)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg">Editar</button>
                  <button type="button" onClick={() => handlePromoDelete(p.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'paquetes' && (
        <div className="space-y-6">
          <Notice msg={packageMsg} />
          <form onSubmit={handlePackageSubmit} noValidate className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label>
              <span className={labelCls}>Nombre</span>
              <input id="package_name" maxLength={150} aria-invalid={Boolean(formErrors.package_name)} className={`${inputCls} ${formErrors.package_name ? 'border-rose-500/60' : ''}`} value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} required />
              {formErrors.package_name && <span className="text-xs text-rose-400 mt-1 block">{formErrors.package_name}</span>}
            </label>
            <label>
              <span className={labelCls}>Precio</span>
              <input id="package_price" type="number" min="0" step="0.01" aria-invalid={Boolean(formErrors.package_price)} className={`${inputCls} ${formErrors.package_price ? 'border-rose-500/60' : ''}`} value={packageForm.price} onChange={e => setPackageForm({ ...packageForm, price: e.target.value })} required />
              {formErrors.package_price && <span className="text-xs text-rose-400 mt-1 block">{formErrors.package_price}</span>}
            </label>
            <label>
              <span className={labelCls}>Activo</span>
              <select className={inputCls} value={packageForm.active ? '1' : '0'} onChange={e => setPackageForm({ ...packageForm, active: e.target.value === '1' })}>
                <option value="1">Si</option>
                <option value="0">No</option>
              </select>
            </label>
            <label className="md:col-span-3">
              <span className={labelCls}>Descripcion</span>
              <input className={inputCls} value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} />
            </label>
            <fieldset className="md:col-span-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <legend className={labelCls}>Productos incluidos en este paquete</legend>
                <button type="button" onClick={addPackageItem} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                  + Agregar artículo
                </button>
              </div>
              {packageForm.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_auto] gap-3 items-end">
                  <label>
                    <span className={labelCls}>Producto</span>
                    <select
                      className={`${inputCls} ${formErrors.package_items ? 'border-rose-500/60' : ''}`}
                      value={item.product_id}
                      onChange={event => updatePackageItem(index, 'product_id', event.target.value)}
                      required
                    >
                      <option value="">Selecciona un producto</option>
                      {packageProducts.map(product => (
                        <option key={product.id} value={product.id}>{product.name} · Bs {product.price}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelCls}>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      className={`${inputCls} ${formErrors.package_items ? 'border-rose-500/60' : ''}`}
                      value={item.quantity}
                      onChange={event => updatePackageItem(index, 'quantity', event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setPackageForm(current => ({
                      ...current,
                      items: current.items.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    className="bg-gray-700 hover:bg-red-900 text-white px-4 py-3 rounded-lg"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {packageForm.items.length === 0 && (
                <p className="text-sm text-gray-500">Aún no agregaste artículos. Puedes agregar los productos o beneficios incluidos.</p>
              )}
              {formErrors.package_items && <span className="text-xs text-rose-400 block">{formErrors.package_items}</span>}
            </fieldset>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">
              {editingPackageId ? 'Guardar cambios' : 'Crear paquete'}
            </button>
            {editingPackageId && (
              <button type="button" onClick={() => { setEditingPackageId(null); setPackageForm({ name: '', description: '', price: '', items: [], active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
                Cancelar
              </button>
            )}
          </form>

          <div className="space-y-3">
            {packages.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay paquetes todavia.</p>}
            {packages.map(p => (
              <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{p.name} <span className="text-gray-400 font-normal">({p.tenants?.name})</span></p>
                  <p className="text-gray-400 text-xs">Bs {Number(p.price).toLocaleString('es-BO')} · {Array.isArray(p.items) ? p.items.length : 0} artículos</p>
                  {Array.isArray(p.items) && p.items.length > 0 && (
                    <p className="text-gray-400 text-xs mt-1">
                      Incluye: {p.items.map(item => typeof item === 'string'
                        ? item
                            : `${item.name || item.label || 'Artículo'} × ${item.quantity || 1}`).join(', ')}
                    </p>
                  )}
                  {p.description && <p className="text-gray-400 text-xs mt-1">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${p.active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button type="button" onClick={() => handlePackageEdit(p)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg">Editar</button>
                  <button type="button" onClick={() => handlePackageDelete(p.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {tab === 'patrocinadores' && (
        <div className="space-y-6">
          <Notice msg={sponsorMsg} />
          <form onSubmit={handleSponsorSubmit} noValidate className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
            <label className="block min-w-0 xl:col-span-3">
              <span className={labelCls}>Nombre</span>
              <input id="sponsor_name" maxLength={150} aria-invalid={Boolean(formErrors.sponsor_name)} className={`${inputCls} ${formErrors.sponsor_name ? 'border-rose-500/60' : ''}`} value={sponsorForm.name} onChange={e => setSponsorForm({ ...sponsorForm, name: e.target.value })} required />
              {formErrors.sponsor_name && <span className="text-xs text-rose-400 mt-1 block">{formErrors.sponsor_name}</span>}
            </label>
            <label className="block min-w-0 xl:col-span-2">
              <span className={labelCls}>Posición</span>
              <select className={inputCls} value={sponsorForm.position} onChange={e => setSponsorForm({ ...sponsorForm, position: e.target.value })}>
                <option value="home">Inicio</option>
                <option value="tienda">Tienda</option>
                <option value="checkout">Pago</option>
                <option value="partidos">Partidos</option>
                <option value="sidebar">Barra lateral</option>
              </select>
            </label>
            <label className="block min-w-0 xl:col-span-7">
              <span className={labelCls}>Logo del patrocinador</span>
              <input
                id="sponsor_logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleSponsorLogoUpload}
                disabled={uploadingSponsorLogo}
                className={`${inputCls} min-w-0 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-emerald-700 file:px-2 file:py-1 file:text-white`}
              />
              <span className="text-[11px] text-gray-500 mt-1 block">PNG, JPG o WEBP · máximo 2 MB</span>
              {formErrors.sponsor_logo && <span className="text-xs text-rose-400 mt-1 block">{formErrors.sponsor_logo}</span>}
              {uploadingSponsorLogo && <span className="text-xs text-emerald-300 mt-1 block">Subiendo logo...</span>}
              {sponsorForm.logo_url && (
                <div className="flex items-center gap-3 mt-2">
                  <img src={sponsorForm.logo_url} alt="Vista previa del logo" className="w-12 h-12 object-contain rounded bg-gray-900 p-1" />
                  <button type="button" onClick={() => setSponsorForm({ ...sponsorForm, logo_url: '' })} className="text-xs text-rose-300 hover:text-rose-200">
                    Quitar logo
                  </button>
                </div>
              )}
            </label>
            <label className="block min-w-0 xl:col-span-7">
              <span className={labelCls}>Enlace del patrocinador (opcional)</span>
              <input id="sponsor_link" type="url" maxLength={500} placeholder="https://sitio-del-patrocinador.com" aria-invalid={Boolean(formErrors.sponsor_link)} className={`${inputCls} ${formErrors.sponsor_link ? 'border-rose-500/60' : ''}`} value={sponsorForm.link} onChange={e => setSponsorForm({ ...sponsorForm, link: e.target.value })} />
              <span className="text-[11px] text-gray-500 mt-1 block">Página que se abrirá al hacer clic en el logo.</span>
              {formErrors.sponsor_link && <span className="text-xs text-rose-400 mt-1 block">{formErrors.sponsor_link}</span>}
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 pt-4 md:col-span-2 xl:col-span-5">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sponsorForm.active} onChange={e => setSponsorForm({ ...sponsorForm, active: e.target.checked })} />
                <span className="text-sm text-gray-300">Activo</span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={uploadingSponsorLogo} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-lg">
                  {editingSponsorId ? 'Guardar cambios' : 'Crear patrocinador'}
                </button>
                {editingSponsorId && (
                  <button type="button" onClick={() => { setEditingSponsorId(null); setSponsorForm({ name: '', logo_url: '', link: '', position: 'home', active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-3 rounded-lg">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="space-y-3">
            {sponsors.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay patrocinadores todavia.</p>}
            {sponsors.map(s => (
              <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm flex items-center gap-3">
                  {s.logo_url && <img src={s.logo_url} alt={s.name} className="w-12 h-12 object-contain rounded" />}
                  <div>
                    <p className="font-bold">{s.name} <span className="text-gray-400 font-normal">({s.tenants?.name})</span></p>
                    <p className="text-gray-400 text-xs">{s.position}{s.link ? ` · ${s.link}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${s.active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
                    {s.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button type="button" onClick={() => handleSponsorEdit(s)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg">Editar</button>
                  <button type="button" onClick={() => handleSponsorDelete(s.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {tab === 'metricas' && (
        <div className="space-y-6">
          <Notice msg={metricsMsg} />
          {!metrics && <p className="text-gray-400">Cargando métricas...</p>}
          {metrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Partidos</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.matches}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Entradas vendidas</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.tickets_sold}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Ocupación</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.sell_through}%</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Ingreso entradas</p>
                  <p className="text-xl font-bold text-emerald-400">Bs {Number(metrics.summary.ticket_revenue).toLocaleString('es-BO')}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Pedidos tienda</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.orders}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Pedidos pagados</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.paid_orders}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Ingreso tienda</p>
                  <p className="text-xl font-bold text-emerald-400">Bs {Number(metrics.summary.store_revenue).toLocaleString('es-BO')}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Ticket promedio</p>
                  <p className="text-xl font-bold text-emerald-400">Bs {Number(metrics.summary.avg_order_value).toLocaleString('es-BO')}</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400">Venta anticipada (4+ dias)</p>
                  <p className="text-xl font-bold text-emerald-400">{metrics.summary.advance_rate}%</p>
                  <p className="text-xs text-gray-400">{metrics.summary.advance_sold}/{metrics.summary.tickets_sold} entradas</p>
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-sm font-semibold mb-2">Distribución global de anticipación</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">0-1 d: {metrics.summary.early_sales?.['0-1'] ?? 0}</span>
                  <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">2-3 d: {metrics.summary.early_sales?.['2-3'] ?? 0}</span>
                  <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">4-7 d: {metrics.summary.early_sales?.['4-7'] ?? 0}</span>
                  <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">8+ d: {metrics.summary.early_sales?.['8+'] ?? 0}</span>
                </div>
              </div>

              <div className="space-y-4">
                {metrics.matches.map(m => (
                  <div key={m.match_id} className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold">{m.opponent}</p>
                        <p className="text-xs text-gray-400">{m.stadium_name} · {new Date(m.match_date).toLocaleString('es-BO')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-300">Ocupación total: <span className="text-emerald-400 font-bold">{m.conversion_rate}%</span></p>
                        <p className="text-xs text-gray-400">{m.total_sold}/{m.total_capacity} entradas · Bs {Number(m.total_revenue).toLocaleString('es-BO')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
                      <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">0-1 d: {m.early_sales?.['0-1'] ?? 0}</span>
                      <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">2-3 d: {m.early_sales?.['2-3'] ?? 0}</span>
                      <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">4-7 d: {m.early_sales?.['4-7'] ?? 0}</span>
                      <span className="bg-gray-900 border border-gray-700 rounded px-2 py-1">8+ d: {m.early_sales?.['8+'] ?? 0}</span>
                      <span className="bg-emerald-900 text-emerald-300 rounded px-2 py-1">Anticipada: {m.advance_rate}%</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-700">
                            <th className="py-2">Tribuna</th>
                            <th className="py-2">Precio</th>
                            <th className="py-2">Capacidad</th>
                            <th className="py-2">Vendidas</th>
                            <th className="py-2">Usadas</th>
                            <th className="py-2">Ocupación</th>
                            <th className="py-2">Ingreso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.zones.map(z => (
                            <tr key={z.zone_id} className="border-b border-gray-700/50">
                              <td className="py-2">{z.zone_name}</td>
                              <td className="py-2">Bs {Number(z.price).toLocaleString('es-BO')}</td>
                              <td className="py-2">{z.capacity}</td>
                              <td className="py-2">{z.sold}</td>
                              <td className="py-2">{z.used}</td>
                              <td className="py-2">{z.conversion_rate}%</td>
                              <td className="py-2">Bs {Number(z.revenue).toLocaleString('es-BO')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {metrics.matches.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay partidos para este club.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
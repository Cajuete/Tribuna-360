import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { promotionService } from '../api/promotion.service';
import { packageService } from '../api/package.service';
import { sponsorService } from '../api/sponsor.service';
import { matchService } from '../api/match.service';

const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white';
const labelCls = 'text-xs text-gray-400 block mb-1';

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
  const [tab, setTab] = useState('promociones');
  const [promotions, setPromotions] = useState([]);
  const [promoMsg, setPromoMsg] = useState(null);
  const [promoForm, setPromoForm] = useState({
    code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both',
    zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true
  });
  const [editingPromoId, setEditingPromoId] = useState(null);
  const [packages, setPackages] = useState([]);
  const [packageMsg, setPackageMsg] = useState(null);
  const [packageForm, setPackageForm] = useState({ name: '', description: '', price: '', items: '[]', active: true });
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [sponsorMsg, setSponsorMsg] = useState(null);
  const [sponsorForm, setSponsorForm] = useState({ name: '', logo_url: '', link: '', position: 'home', active: true });
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsMsg, setMetricsMsg] = useState(null);
  const [tenantId, setTenantId] = useState(user?.tenant_id || '');

  const isSuperadmin = user?.role === 'superadmin';

  const loadPromotions = () => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    promotionService.getAll(qs)
      .then(res => { if (res.success) setPromotions(res.data); })
      .catch(err => setPromoMsg({ ok: false, text: err.message }));
  };

  const loadPackages = () => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    packageService.getAll(qs)
      .then(res => { if (res.success) setPackages(res.data); })
      .catch(err => setPackageMsg({ ok: false, text: err.message }));
  };

  const loadSponsors = () => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    sponsorService.getAll(qs)
      .then(res => { if (res.success) setSponsors(res.data); })
      .catch(err => setSponsorMsg({ ok: false, text: err.message }));
  };

  const loadMetrics = () => {
    const qs = isSuperadmin && tenantId ? `?tenant_id=${tenantId}` : '';
    promotionService.getMetrics(qs)
      .then(res => { if (res.success) setMetrics(res.data); })
      .catch(err => setMetricsMsg({ ok: false, text: err.message }));
  };

  useEffect(() => {
    loadPromotions();
    loadPackages();
    loadSponsors();
    loadMetrics();
  }, [tenantId]);

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...promoForm, tenant_id: isSuperadmin ? tenantId : undefined };
      if (editingPromoId) {
        await promotionService.update(editingPromoId, payload);
        setPromoMsg({ ok: true, text: 'Promoción actualizada.' });
      } else {
        await promotionService.create(payload);
        setPromoMsg({ ok: true, text: 'Promoción creada.' });
      }
      setPromoForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both', zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true });
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
    try {
      const items = JSON.parse(packageForm.items || '[]');
      const payload = { ...packageForm, items, price: Number(packageForm.price), tenant_id: isSuperadmin ? tenantId : undefined };
      if (editingPackageId) {
        await packageService.update(editingPackageId, payload);
        setPackageMsg({ ok: true, text: 'Paquete actualizado.' });
      } else {
        await packageService.create(payload);
        setPackageMsg({ ok: true, text: 'Paquete creado.' });
      }
      setPackageForm({ name: '', description: '', price: '', items: '[]', active: true });
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
      items: JSON.stringify(p.items || [], null, 2),
      active: p.active !== false
    });
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
        {['promociones', 'paquetes', 'patrocinadores', 'metricas'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === t ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white'}`}
          >
            {t === 'promociones' ? 'Promociones' : t === 'paquetes' ? 'Paquetes' : t === 'patrocinadores' ? 'Patrocinadores' : 'Métricas de conversión'}
          </button>
        ))}
      </div>

      {isSuperadmin && (
        <div className="mb-4">
          <label className={labelCls}>Club (tenant_id)</label>
          <input className={inputCls} value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="UUID del club" />
        </div>
      )}

      {tab === 'promociones' && (
        <div className="space-y-6">
          <Notice msg={promoMsg} />
          <form onSubmit={handlePromoSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label>
              <span className={labelCls}>Código</span>
              <input className={inputCls} value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value })} required />
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
              <input type="number" min="0" step="0.01" className={inputCls} value={promoForm.discount_value} onChange={e => setPromoForm({ ...promoForm, discount_value: e.target.value })} required />
            </label>
            <label>
              <span className={labelCls}>Aplica a</span>
              <select className={inputCls} value={promoForm.applies_to} onChange={e => setPromoForm({ ...promoForm, applies_to: e.target.value })}>
                <option value="both">Ambos</option>
                <option value="tickets">Entradas</option>
                <option value="products">Tienda</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span className={labelCls}>Descripción</span>
              <input className={inputCls} value={promoForm.description} onChange={e => setPromoForm({ ...promoForm, description: e.target.value })} />
            </label>
            <label>
              <span className={labelCls}>Zona (opcional)</span>
              <input className={inputCls} value={promoForm.zone_name} onChange={e => setPromoForm({ ...promoForm, zone_name: e.target.value })} placeholder="General" />
            </label>
            <label>
              <span className={labelCls}>Usos máximos</span>
              <input type="number" min="1" className={inputCls} value={promoForm.max_uses} onChange={e => setPromoForm({ ...promoForm, max_uses: e.target.value })} />
            </label>
            <label>
              <span className={labelCls}>Inicio</span>
              <input type="datetime-local" className={inputCls} value={promoForm.starts_at} onChange={e => setPromoForm({ ...promoForm, starts_at: e.target.value })} />
            </label>
            <label>
              <span className={labelCls}>Fin</span>
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
              <button type="button" onClick={() => { setEditingPromoId(null); setPromoForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', applies_to: 'both', zone_name: '', max_uses: '', starts_at: '', ends_at: '', is_active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
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
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `Bs ${p.discount_value}`} · {p.applies_to}
                    {p.zone_name ? ` · ${p.zone_name}` : ''}
                    {p.max_uses ? ` · usos ${p.used_count || 0}/${p.max_uses}` : ''}
                  </p>
                  {p.description && <p className="text-gray-400 text-xs mt-1">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${p.is_active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
                    {p.is_active ? 'Activa' : 'Inactiva'}
                  </span>
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
          <form onSubmit={handlePackageSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label>
              <span className={labelCls}>Nombre</span>
              <input className={inputCls} value={packageForm.name} onChange={e => setPackageForm({ ...packageForm, name: e.target.value })} required />
            </label>
            <label>
              <span className={labelCls}>Precio</span>
              <input type="number" min="0" step="0.01" className={inputCls} value={packageForm.price} onChange={e => setPackageForm({ ...packageForm, price: e.target.value })} required />
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
            <label className="md:col-span-3">
              <span className={labelCls}>Items (JSON)</span>
              <textarea className={inputCls} rows={4} value={packageForm.items} onChange={e => setPackageForm({ ...packageForm, items: e.target.value })} />
            </label>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">
              {editingPackageId ? 'Guardar cambios' : 'Crear paquete'}
            </button>
            {editingPackageId && (
              <button type="button" onClick={() => { setEditingPackageId(null); setPackageForm({ name: '', description: '', price: '', items: '[]', active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
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
                  <p className="text-gray-400 text-xs">Bs {Number(p.price).toLocaleString('es-BO')} · {Array.isArray(p.items) ? p.items.length : 0} item(s)</p>
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
          <form onSubmit={handleSponsorSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label>
              <span className={labelCls}>Nombre</span>
              <input className={inputCls} value={sponsorForm.name} onChange={e => setSponsorForm({ ...sponsorForm, name: e.target.value })} required />
            </label>
            <label>
              <span className={labelCls}>Posicion</span>
              <select className={inputCls} value={sponsorForm.position} onChange={e => setSponsorForm({ ...sponsorForm, position: e.target.value })}>
                <option value="home">Inicio</option>
                <option value="tienda">Tienda</option>
                <option value="checkout">Checkout</option>
                <option value="partidos">Partidos</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </label>
            <label>
              <span className={labelCls}>Logo URL</span>
              <input className={inputCls} value={sponsorForm.logo_url} onChange={e => setSponsorForm({ ...sponsorForm, logo_url: e.target.value })} />
            </label>
            <label>
              <span className={labelCls}>Link</span>
              <input className={inputCls} value={sponsorForm.link} onChange={e => setSponsorForm({ ...sponsorForm, link: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sponsorForm.active} onChange={e => setSponsorForm({ ...sponsorForm, active: e.target.checked })} />
              <span className="text-sm text-gray-300">Activo</span>
            </label>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">
              {editingSponsorId ? 'Guardar cambios' : 'Crear patrocinador'}
            </button>
            {editingSponsorId && (
              <button type="button" onClick={() => { setEditingSponsorId(null); setSponsorForm({ name: '', logo_url: '', link: '', position: 'home', active: true }); }} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">
                Cancelar
              </button>
            )}
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
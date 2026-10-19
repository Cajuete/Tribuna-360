import { useState, useEffect } from 'react';
import { matchService } from '../api/match.service';
import { orderService } from '../api/order.service';
import { membershipService } from '../api/membership.service';
import { tenantService } from '../api/tenant.service';
import { userService } from '../api/user.service';
import { productService } from '../api/product.service';
import { useAuth } from '../context/auth-context';

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  club_admin: 'Admin de club',
  sales_manager: 'Gerente de ventas',
  box_office_cashier: 'Taquillero',
  stadium_manager: 'Gerente de estadio',
  financial_auditor: 'Auditor financiero',
  customer_support: 'Soporte',
  gate_operator: 'Operador de puerta',
  fan: 'Hincha',
};

const STATUS_STYLES = {
  pending: 'bg-yellow-900 text-yellow-300',
  paid: 'bg-emerald-900 text-emerald-300',
  shipped: 'bg-sky-900 text-sky-300',
  cancelled: 'bg-red-900 text-red-300',
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  paid: 'Pagado',
  shipped: 'Despachado',
  cancelled: 'Cancelado',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const [form, setForm] = useState({ tenant_id: '', opponent: '', match_date: '', stadium_name: 'Estadio Hernando Siles' });
  const [message, setMessage] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [membershipsError, setMembershipsError] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantForm, setTenantForm] = useState({ name: '', slug: '' });
  const [tenantError, setTenantError] = useState(null);
  const [tenantOk, setTenantOk] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignForm, setAssignForm] = useState({ user_id: '', role: 'club_admin', tenant_id: '' });
  const [assignMsg, setAssignMsg] = useState(null);
  const [adminMatches, setAdminMatches] = useState([]);
  const [zoneMatchId, setZoneMatchId] = useState('');
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState({ name: '', price: '', capacity: '' });
  const [zoneMsg, setZoneMsg] = useState(null);
  const [products, setProducts] = useState([]);
  const [prodForm, setProdForm] = useState({ name: '', description: '', price: '', stock: '', tenant_id: '' });
  const [prodMsg, setProdMsg] = useState(null);
  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState({ name: '', price: '', benefits: '', tenant_id: '' });
  const [planMsg, setPlanMsg] = useState(null);

  const loadProducts = () => {
    productService.getAll()
      .then(res => { if (res.success) setProducts(res.data); })
      .catch(err => setProdMsg({ ok: false, text: err.message }));
  };

  const loadPlans = () => {
    membershipService.getPlans()
      .then(res => { if (res.status === 'success') setPlans(res.data); })
      .catch(err => setPlanMsg({ ok: false, text: err.message }));
  };

  useEffect(() => { loadProducts(); loadPlans(); }, []);

  const myProducts = isSuperadmin ? products : products.filter(p => p.tenant_id === user?.tenant_id);
  const myPlans = isSuperadmin ? plans : plans.filter(p => p.tenant_id === user?.tenant_id);

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    setProdMsg(null);
    try {
      const res = await productService.create({
        ...prodForm,
        tenant_id: isSuperadmin ? prodForm.tenant_id : undefined,
      });
      setProdMsg({ ok: true, text: res.message });
      setProdForm({ name: '', description: '', price: '', stock: '', tenant_id: '' });
      loadProducts();
    } catch (err) {
      setProdMsg({ ok: false, text: err.message });
    }
  };

  const handleProdDelete = async (id) => {
    setProdMsg(null);
    try {
      const res = await productService.remove(id);
      setProdMsg({ ok: true, text: res.message });
      loadProducts();
    } catch (err) {
      setProdMsg({ ok: false, text: err.message });
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    setPlanMsg(null);
    try {
      const res = await membershipService.createPlan({
        ...planForm,
        tenant_id: isSuperadmin ? planForm.tenant_id : undefined,
      });
      setPlanMsg({ ok: true, text: res.message });
      setPlanForm({ name: '', price: '', benefits: '', tenant_id: '' });
      loadPlans();
    } catch (err) {
      setPlanMsg({ ok: false, text: err.message });
    }
  };

  const handlePlanDelete = async (id) => {
    setPlanMsg(null);
    try {
      const res = await membershipService.deletePlan(id);
      setPlanMsg({ ok: true, text: res.message });
      loadPlans();
    } catch (err) {
      setPlanMsg({ ok: false, text: err.message });
    }
  };

  const loadZones = (matchId) => {
    if (!matchId) { setZones([]); return; }
    matchService.getZones(matchId)
      .then(res => { if (res.status === 'success') setZones(res.data); })
      .catch(err => setZoneMsg({ ok: false, text: err.message }));
  };

  useEffect(() => {
    const qs = !isSuperadmin && user?.tenant_id ? `?tenant_id=${user.tenant_id}` : '';
    matchService.getAllMatches(qs)
      .then(res => { if (res.status === 'success') setAdminMatches(res.data); })
      .catch(err => setZoneMsg({ ok: false, text: err.message }));
  }, [user?.tenant_id, isSuperadmin]);

  const handleZoneMatchChange = (matchId) => {
    setZoneMatchId(matchId);
    setZoneMsg(null);
    loadZones(matchId);
  };

  const handleZoneSubmit = async (e) => {
    e.preventDefault();
    setZoneMsg(null);
    try {
      const res = await matchService.addZone(zoneMatchId, zoneForm);
      setZoneMsg({ ok: true, text: res.message });
      setZoneForm({ name: '', price: '', capacity: '' });
      loadZones(zoneMatchId);
    } catch (err) {
      setZoneMsg({ ok: false, text: err.message });
    }
  };

  const handleZoneDelete = async (zoneId) => {
    setZoneMsg(null);
    try {
      const res = await matchService.deleteZone(zoneId);
      setZoneMsg({ ok: true, text: res.message });
      loadZones(zoneMatchId);
    } catch (err) {
      setZoneMsg({ ok: false, text: err.message });
    }
  };

  const loadUsers = () => {
    userService.getAll()
      .then(res => { if (res.status === 'success') setUsers(res.data); })
      .catch(err => setAssignMsg({ ok: false, text: err.message }));
  };

  useEffect(() => { if (isSuperadmin) loadUsers(); }, [isSuperadmin]);

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignMsg(null);
    try {
      const res = await userService.assignRole(assignForm.user_id, {
        role: assignForm.role,
        tenant_id: assignForm.tenant_id || null,
      });
      setAssignMsg({ ok: true, text: res.message });
      loadUsers();
    } catch (err) {
      setAssignMsg({ ok: false, text: err.message });
    }
  };

  const loadTenants = () => {
    tenantService.getAll()
      .then(res => { if (res.status === 'success') setTenants(res.data); })
      .catch(err => setTenantError(err.message));
  };

  useEffect(() => {
    loadTenants();
    if (isSuperadmin) loadUsers();
  }, [isSuperadmin]);

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    setTenantError(null);
    setTenantOk(null);
    try {
      const res = await tenantService.create(tenantForm);
      setTenantOk(res.message);
      setTenantForm({ name: '', slug: '' });
      loadTenants();
    } catch (err) {
      setTenantError(err.message);
    }
  };

  const loadOrders = () => {
    orderService.getAll()
      .then(res => { if (res.success) setOrders(res.data); })
      .catch(err => setOrdersError(err.message));
  };

  const loadMemberships = () => {
    membershipService.getAll()
      .then(res => { if (res.status === 'success') setMemberships(res.data); })
      .catch(err => setMembershipsError(err.message));
  };

  useEffect(() => { loadOrders(); loadMemberships(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await matchService.createMatch(form);
      setMessage({ ok: true, text: '¡Partido creado y publicado con éxito!' });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const handleStatus = async (id, status) => {
    setOrdersError(null);
    try {
      await orderService.updateStatus(id, status);
      loadOrders();
    } catch (err) {
      setOrdersError(err.message);
    }
  };

  const handleCancelMembership = async (id) => {
    setMembershipsError(null);
    try {
      await membershipService.cancel(id);
      loadMemberships();
    } catch (err) {
      setMembershipsError(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h2 className="text-3xl font-bold mb-6">Panel de Administración</h2>
        <h3 className="text-xl font-semibold mb-3">Nuevo partido</h3>
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
          <input type="text" placeholder="Rival" value={form.opponent} onChange={e => setForm({...form, opponent: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          <select
            value={isSuperadmin ? form.tenant_id : (user?.tenant_id || '')}
            onChange={e => setForm({...form, tenant_id: e.target.value})}
            disabled={!isSuperadmin}
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white disabled:opacity-60"
          >
            <option value="">Selecciona el club...</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input type="datetime-local" value={form.match_date} onChange={e => setForm({...form, match_date: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          <input type="text" placeholder="Estadio" value={form.stadium_name} onChange={e => setForm({...form, stadium_name: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">Guardar Partido</button>
        </form>
        {message && <p className={`mt-4 p-3 rounded text-center ${message.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{message.text}</p>}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Zonas por partido</h3>
        {zoneMsg && <p className={`mb-3 p-3 rounded text-center ${zoneMsg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{zoneMsg.text}</p>}
        <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 space-y-4">
          <label className="block">
            <span className="text-xs text-gray-400 block mb-1">Selecciona un partido</span>
            <select value={zoneMatchId} onChange={e => handleZoneMatchChange(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
              <option value="">-- Elige un partido --</option>
              {adminMatches.map(m => (
                <option key={m.id} value={m.id}>
                  {new Date(m.match_date).toLocaleDateString()} vs {m.opponent} ({m.stadium_name})
                </option>
              ))}
            </select>
          </label>

          {zoneMatchId && (
            <>
              <div className="space-y-2">
                {zones.length === 0 && <p className="text-gray-400 text-sm">Este partido no tiene zonas todavía.</p>}
                {zones.map(z => (
                  <div key={z.id} className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span><span className="font-bold">{z.name}</span> · Bs {z.price} · aforo {z.capacity}</span>
                    <button type="button" onClick={() => handleZoneDelete(z.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleZoneSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border-t border-gray-700 pt-4">
                <label className="md:col-span-2">
                  <span className="text-xs text-gray-400 block mb-1">Nombre (Curva Sur, Butacas...)</span>
                  <input type="text" value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
                </label>
                <label>
                  <span className="text-xs text-gray-400 block mb-1">Precio Bs</span>
                  <input type="number" min="0" step="1" value={zoneForm.price} onChange={e => setZoneForm({ ...zoneForm, price: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
                </label>
                <label>
                  <span className="text-xs text-gray-400 block mb-1">Aforo</span>
                  <input type="number" min="1" step="1" value={zoneForm.capacity} onChange={e => setZoneForm({ ...zoneForm, capacity: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
                </label>
                <button type="submit" className="md:col-span-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg">Agregar zona</button>
              </form>
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Pedidos de la tienda</h3>
        {ordersError && <p className="mb-3 p-3 rounded text-center bg-red-900 text-red-300">{ordersError}</p>}
        {orders.length === 0 && !ordersError && (
          <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay pedidos todavía.</p>
        )}
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold">{o.products?.name} × {o.quantity}</p>
                <p className="text-gray-400 text-xs">{o.users?.full_name || o.users?.email} · {o.tenants?.name} · {new Date(o.created_at).toLocaleString()}</p>
                <p className="text-emerald-400 font-semibold mt-1">Bs {o.total}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-700 text-gray-300'}`}>
                  {STATUS_LABELS[o.status] || o.status}
                </span>
                {o.status === 'paid' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleStatus(o.id, 'shipped')} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Despachar</button>
                    <button type="button" onClick={() => handleStatus(o.id, 'cancelled')} className="bg-red-800 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Cancelar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Socios del club</h3>
        {membershipsError && <p className="mb-3 p-3 rounded text-center bg-red-900 text-red-300">{membershipsError}</p>}
        {memberships.length === 0 && !membershipsError && (
          <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay socios registrados todavía.</p>
        )}
        <div className="space-y-3">
          {memberships.map(m => (
            <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold">{m.users?.full_name || m.users?.email} · {m.membership_plans?.name}</p>
                <p className="text-gray-400 text-xs">{m.tenants?.name} · Bs {m.membership_plans?.price}/mes · {new Date(m.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${
                  m.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'
                }`}>
                  {m.status === 'active' ? 'Activa' : 'Cancelada'}
                </span>
                {m.status === 'active' && (
                  <button type="button" onClick={() => handleCancelMembership(m.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Cancelar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Productos de la tienda</h3>
        {prodMsg && <p className={`mb-3 p-3 rounded text-center ${prodMsg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{prodMsg.text}</p>}
        <form onSubmit={handleProdSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
          <label className="md:col-span-2">
            <span className="text-xs text-gray-400 block mb-1">Nombre</span>
            <input type="text" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-gray-400 block mb-1">Descripción</span>
            <input type="text" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          <label>
            <span className="text-xs text-gray-400 block mb-1">Precio Bs</span>
            <input type="number" min="0" step="1" value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          <label>
            <span className="text-xs text-gray-400 block mb-1">Stock</span>
            <input type="number" min="0" step="1" value={prodForm.stock} onChange={e => setProdForm({ ...prodForm, stock: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          {isSuperadmin && (
            <label className="md:col-span-2">
              <span className="text-xs text-gray-400 block mb-1">Club</span>
              <select value={prodForm.tenant_id} onChange={e => setProdForm({ ...prodForm, tenant_id: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                <option value="">Selecciona...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="md:col-span-5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg">Agregar producto</button>
        </form>
        <div className="space-y-3">
          {myProducts.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay productos todavía.</p>}
          {myProducts.map(p => (
            <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-gray-400 text-xs">{p.tenants?.name} · stock {p.stock} · {p.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">Bs {p.price}</span>
                <button type="button" onClick={() => handleProdDelete(p.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">Planes de socio</h3>
        {planMsg && <p className={`mb-3 p-3 rounded text-center ${planMsg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{planMsg.text}</p>}
        <form onSubmit={handlePlanSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
          <label>
            <span className="text-xs text-gray-400 block mb-1">Nombre (Socio Dorado...)</span>
            <input type="text" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          <label>
            <span className="text-xs text-gray-400 block mb-1">Precio mensual Bs</span>
            <input type="number" min="0" step="1" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-gray-400 block mb-1">Beneficios</span>
            <input type="text" value={planForm.benefits} onChange={e => setPlanForm({ ...planForm, benefits: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </label>
          {isSuperadmin && (
            <label className="md:col-span-3">
              <span className="text-xs text-gray-400 block mb-1">Club</span>
              <select value={planForm.tenant_id} onChange={e => setPlanForm({ ...planForm, tenant_id: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                <option value="">Selecciona...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">Crear plan</button>
        </form>
        <div className="space-y-3">
          {myPlans.length === 0 && <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay planes todavía.</p>}
          {myPlans.map(p => (
            <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-bold">{p.name} <span className="text-gray-400 font-normal">({p.tenants?.name})</span></p>
                <p className="text-gray-400 text-xs">{p.benefits}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">Bs {p.price}/mes</span>
                <button type="button" onClick={() => handlePlanDelete(p.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isSuperadmin && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Gestión de clubes (superadmin)</h3>
          {tenantError && <p className="mb-3 p-3 rounded text-center bg-red-900 text-red-300">{tenantError}</p>}
          {tenantOk && <p className="mb-3 p-3 rounded text-center bg-emerald-900 text-emerald-300">{tenantOk}</p>}
          <form onSubmit={handleTenantSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 flex flex-wrap gap-3 items-end mb-4">
            <label className="flex-1 min-w-40">
              <span className="text-xs text-gray-400 block mb-1">Nombre del club</span>
              <input type="text" value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
            </label>
            <label className="flex-1 min-w-40">
              <span className="text-xs text-gray-400 block mb-1">Slug (identificador corto)</span>
              <input type="text" value={tenantForm.slug} onChange={e => setTenantForm({ ...tenantForm, slug: e.target.value })} required pattern="[a-z0-9-]+" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
            </label>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg">Crear Club</button>
          </form>
          <div className="space-y-3">
            {tenants.map(t => (
              <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{t.name}</p>
                  <p className="text-gray-400 text-xs">slug: {t.slug} · {t.id}</p>
                  {t.stadium_name && (
                    <p className="text-gray-400 text-xs mt-1">
                      Estadio: {t.stadium_name}
                      {t.stadium_capacity ? ` · ${t.stadium_capacity} localidades` : ''}
                      {t.associations ? ` · ${t.associations.name}` : ''}
                      {t.department ? ` · ${t.department}` : ''}
                    </p>
                  )}
                  {(t.personeria || t.run_code) && (
                    <p className="text-gray-500 text-xs">
                      Legal: {t.personeria || 's/informar'}{t.run_code ? ` · RUN ${t.run_code}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-semibold mt-8 mb-3">Usuarios y roles</h3>
          {assignMsg && <p className={`mb-3 p-3 rounded text-center ${assignMsg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{assignMsg.text}</p>}
          <form onSubmit={handleAssign} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
            <label className="md:col-span-2">
              <span className="text-xs text-gray-400 block mb-1">Usuario</span>
              <select value={assignForm.user_id} onChange={e => setAssignForm({ ...assignForm, user_id: e.target.value })} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                <option value="">Selecciona un usuario...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs text-gray-400 block mb-1">Rol</span>
              <select value={assignForm.role} onChange={e => setAssignForm({ ...assignForm, role: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg">Asignar</button>
            <label className="md:col-span-4">
              <span className="text-xs text-gray-400 block mb-1">Club (obligatorio para roles de club; déjalo vacío para superadmin/hincha)</span>
              <select value={assignForm.tenant_id} onChange={e => setAssignForm({ ...assignForm, tenant_id: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
                <option value="">Sin club</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </form>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-bold">{u.full_name || u.email}</p>
                  <p className="text-gray-400 text-xs">{u.email} · {u.tenants?.name || 'sin club'}</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full uppercase font-semibold bg-gray-900 border border-gray-700 text-emerald-300">
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { matchService } from '../api/match.service';
import { orderService } from '../api/order.service';
import { membershipService } from '../api/membership.service';
import { tenantService } from '../api/tenant.service';
import { saasService } from '../api/saas.service';
import { userService } from '../api/user.service';
import { productService } from '../api/product.service';
import { ticketService } from '../api/ticket.service';
import { uploadService } from '../api/upload.service';
import { useAuth } from '../context/auth-context';
import { ROLE_LABELS, STAFF_ROLES, getAdminTabs } from '../config/roles';
import ClubLogo from '../components/ClubLogo';

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

const MATCH_STATUS_LABELS = {
  scheduled: 'Programado',
  live: 'En vivo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white';
const labelCls = 'text-xs text-gray-400 block mb-1';

const formatMatchDate = (iso) => new Date(iso).toLocaleString('es-BO', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const toLocalInput = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const minMatchDate = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function Notice({ msg }) {
  if (!msg) return null;
  return (
    <p className={`mb-3 p-3 rounded text-center ${msg.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
      {msg.text}
    </p>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-[0.7rem] uppercase tracking-widest text-gray-500">{label}</p>
      <p className="font-display text-2xl font-extrabold text-emerald-400 mt-2">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const isSuperadmin = role === 'superadmin';
  const isClubAdmin = role === 'club_admin';
  const isFullAdmin = isSuperadmin || isClubAdmin;
  const isSalesManager = role === 'sales_manager';
  const isAuditor = role === 'financial_auditor';
  const isSupport = role === 'customer_support';
  const isCashier = role === 'box_office_cashier';
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({ tenant_id: '', opponent: '', competition: '', matchday: '', match_date: '', stadium_name: '' });
  const [matchFile, setMatchFile] = useState(null);
  const [matchPreview, setMatchPreview] = useState(null);
  const [draftZones, setDraftZones] = useState([]);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editForm, setEditForm] = useState({ opponent: '', competition: '', matchday: '', match_date: '', stadium_name: '', status: 'scheduled' });
  const [editMatchFile, setEditMatchFile] = useState(null);
  const [editMatchPreview, setEditMatchPreview] = useState(null);
  const [matchListMsg, setMatchListMsg] = useState(null);
  const [message, setMessage] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [membershipsError, setMembershipsError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketsError, setTicketsError] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [saasOverview, setSaasOverview] = useState(null);
  const [saasSettings, setSaasSettings] = useState(null);
  const [saasMsg, setSaasMsg] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ payment_provider: 'simulado', payment_public_key: '', payment_secret_key: '', platform_commission_rate: 5, currency: 'BOB' });
  const [tenantForm, setTenantForm] = useState({ name: '', slug: '' });
  const [tenantError, setTenantError] = useState(null);
  const [tenantOk, setTenantOk] = useState(null);
  const [users, setUsers] = useState([]);
  const [assignForm, setAssignForm] = useState({ user_id: '', role: '', tenant_id: '' });
  const [assignMsg, setAssignMsg] = useState(null);
  const [staffForm, setStaffForm] = useState({ full_name: '', email: '', password: '', role: 'sales_manager', tenant_id: '' });
  const [staffMsg, setStaffMsg] = useState(null);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [adminMatches, setAdminMatches] = useState([]);
  const [zoneMatchId, setZoneMatchId] = useState('');
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState({ name: '', price: '', capacity: '', tickets_for_sale: '', is_enabled: true });
  const [zoneMsg, setZoneMsg] = useState(null);
  const [products, setProducts] = useState([]);
  const [prodForm, setProdForm] = useState({ name: '', description: '', category: '', price: '', stock: '', tenant_id: '' });
  const [prodMsg, setProdMsg] = useState(null);
  const [prodFile, setProdFile] = useState(null);
  const [prodPreview, setProdPreview] = useState(null);
  const [prodListMsg, setProdListMsg] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProductForm, setEditProductForm] = useState({ name: '', description: '', category: '', price: '', stock: '' });
  const [editProductFile, setEditProductFile] = useState(null);
  const [editProductPreview, setEditProductPreview] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
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

  const loadTickets = () => {
    ticketService.getAll()
      .then(res => { if (res.success) setTickets(res.data); })
      .catch(err => setTicketsError(err.message));
  };

  const loadUsers = () => {
    userService.getAll()
      .then(res => { if (res.status === 'success') setUsers(res.data); })
      .catch(err => setAssignMsg({ ok: false, text: err.message }));
  };

  const loadTenants = () => {
    tenantService.getAll()
      .then(res => { if (res.status === 'success') setTenants(res.data); })
      .catch(err => setTenantError(err.message));
  };

  const loadSaasOverview = () => {
    if (!isSuperadmin) return;
    saasService.getOverview()
      .then(res => { if (res.status === 'success') setSaasOverview(res.data); })
      .catch(err => setSaasMsg({ ok: false, text: err.message }));
  };

  const loadSaasSettings = () => {
    if (!isSuperadmin) return;
    saasService.getSettings()
      .then(res => {
        if (res.status === 'success') {
          setSaasSettings(res.data);
          setSettingsForm({
            payment_provider: res.data.payment_provider || 'simulado',
            payment_public_key: res.data.payment_public_key || '',
            payment_secret_key: '',
            platform_commission_rate: res.data.platform_commission_rate ?? 5,
            currency: res.data.currency || 'BOB',
          });
        }
      })
      .catch(err => setSaasMsg({ ok: false, text: err.message }));
  };

  useEffect(() => {
    loadTenants();
    loadAdminMatches();
    if (isSuperadmin) {
      loadSaasOverview();
      loadSaasSettings();
    }
    if (!isCashier) {
      loadProducts();
      loadPlans();
    }
    if (isFullAdmin || isSalesManager || isAuditor || isSupport) {
      loadOrders();
    }
    if (isFullAdmin || isAuditor || isSupport) {
      loadMemberships();
    }
    if (isFullAdmin || isSalesManager || isAuditor || isCashier) {
      loadTickets();
    }
    if (isFullAdmin || isSupport) {
      loadUsers();
    }
  }, [role]);

  const loadAdminMatches = () => {
    const qs = !isSuperadmin && user?.tenant_id ? `?tenant_id=${user.tenant_id}` : '';
    matchService.getAllMatches(qs)
      .then(res => { if (res.status === 'success') setAdminMatches(res.data); })
      .catch(err => setMatchListMsg({ ok: false, text: err.message }));
  };

  useEffect(() => {
    const qs = !isSuperadmin && user?.tenant_id ? `?tenant_id=${user.tenant_id}` : '';
    matchService.getAllMatches(qs)
      .then(res => { if (res.status === 'success') setAdminMatches(res.data); })
      .catch(err => setMatchListMsg({ ok: false, text: err.message }));
  }, [user?.tenant_id, isSuperadmin]);

  const myTenant = !isSuperadmin && user?.tenant_id ? tenants.find(t => t.id === user.tenant_id) : null;

  const myProducts = isSuperadmin ? products : products.filter(p => p.tenant_id === user?.tenant_id);
  const myPlans = isSuperadmin ? plans : plans.filter(p => p.tenant_id === user?.tenant_id);

  const productQuery = productSearch.trim().toLowerCase();
  const visibleProducts = myProducts.filter(p =>
    !productQuery || [p.name, p.category, p.description].filter(Boolean).join(' ').toLowerCase().includes(productQuery)
  );
  const visibleOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
  const orderCount = (status) => status === 'all' ? orders.length : orders.filter(o => o.status === status).length;

  const storeRevenue = orders
    .filter(o => o.status === 'paid' || o.status === 'shipped')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const ticketRevenue = tickets.reduce((sum, t) => sum + Number(t.price || 0), 0);
  const ticketsUsed = tickets.filter(t => t.status === 'used').length;
  const activeMemberships = memberships.filter(m => m.status === 'active');
  const membershipRevenue = activeMemberships.reduce((sum, m) => sum + Number(m.membership_plans?.price || 0), 0);
  const upcomingMatches = adminMatches.filter(m => m.status === 'scheduled').length;

  const tabs = getAdminTabs(role);

  const roleOptions = isSuperadmin
    ? Object.entries(ROLE_LABELS)
    : STAFF_ROLES.map(r => [r, ROLE_LABELS[r]]);

  const requestedTab = searchParams.get('tab');
  const tab = tabs.some(t => t.id === requestedTab) ? requestedTab : 'resumen';

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'resumen') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next);
  };

  const chooseImage = (file, currentPreview, setFile, setPreview, setError) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError({ ok: false, text: 'Formato no permitido. Usa PNG, JPG o WEBP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError({ ok: false, text: 'La imagen supera el máximo de 2 MB.' });
      return;
    }
    if (currentPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPreview);
    setError(null);
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const pickProdImage = (e) => chooseImage(e.target.files?.[0], prodPreview, setProdFile, setProdPreview, setProdMsg);
  const pickMatchImage = (e) => chooseImage(e.target.files?.[0], matchPreview, setMatchFile, setMatchPreview, setMessage);
  const clearMatchImage = () => {
    if (matchPreview?.startsWith('blob:')) URL.revokeObjectURL(matchPreview);
    setMatchFile(null);
    setMatchPreview(null);
  };
  const pickEditMatchImage = (e) => chooseImage(e.target.files?.[0], editMatchPreview, setEditMatchFile, setEditMatchPreview, setMatchListMsg);
  const clearEditMatchImage = () => {
    if (editMatchPreview?.startsWith('blob:')) URL.revokeObjectURL(editMatchPreview);
    setEditMatchFile(null);
    setEditMatchPreview(null);
  };
  const clearProdImage = () => {
    if (prodPreview?.startsWith('blob:')) URL.revokeObjectURL(prodPreview);
    setProdFile(null);
    setProdPreview(null);
  };

  const pickEditProductImage = (e) => chooseImage(e.target.files?.[0], editProductPreview, setEditProductFile, setEditProductPreview, setProdListMsg);
  const clearEditProductImage = () => {
    if (editProductPreview?.startsWith('blob:')) URL.revokeObjectURL(editProductPreview);
    setEditProductFile(null);
    const original = myProducts.find(p => p.id === editingProductId);
    setEditProductPreview(original?.image_url || null);
  };

  const handleProdSubmit = async (e) => {
    e.preventDefault();
    setProdMsg(null);

    const price = Number(prodForm.price);
    const stock = Number.parseInt(prodForm.stock, 10);

    if (!prodForm.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setProdMsg({ ok: false, text: 'Completa nombre, precio (>=0) y stock (>=0).' });
      return;
    }

    try {
      let image_url = null;
      if (prodFile) {
        const uploaded = await uploadService.productImage(prodFile);
        image_url = uploaded.data.url;
      }

      const res = await productService.create({
        name: prodForm.name.trim(),
        description: prodForm.description.trim(),
        category: prodForm.category.trim(),
        price,
        stock,
        image_url,
        tenant_id: isSuperadmin ? prodForm.tenant_id : undefined,
      });

      setProdMsg({ ok: true, text: res.message });
      setProdForm({ name: '', description: '', category: '', price: '', stock: '', tenant_id: '' });
      if (prodPreview?.startsWith('blob:')) URL.revokeObjectURL(prodPreview);
      setProdFile(null);
      setProdPreview(null);
      loadProducts();
    } catch (err) {
      setProdMsg({ ok: false, text: err.message });
    }
  };

  const handleProdEditStart = (product) => {
    setEditingProductId(product.id);
    setEditProductForm({
      name: product.name || '',
      description: product.description || '',
      category: product.category || '',
      price: product.price ?? '',
      stock: product.stock ?? '',
    });
    setEditProductFile(null);
    setEditProductPreview(product.image_url || null);
    setProdListMsg(null);
  };

  const handleProdUpdate = async (e) => {
    e.preventDefault();
    setProdListMsg(null);

    const price = Number(editProductForm.price);
    const stock = Number.parseInt(editProductForm.stock, 10);

    if (!editProductForm.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setProdListMsg({ ok: false, text: 'Completa nombre, precio (>=0) y stock (>=0).' });
      return;
    }

    const payload = {
      name: editProductForm.name.trim(),
      description: editProductForm.description.trim(),
      price,
      stock,
    };
    if (editProductForm.category.trim()) payload.category = editProductForm.category.trim();

    try {
      if (editProductFile) {
        const uploaded = await uploadService.productImage(editProductFile);
        payload.image_url = uploaded.data.url;
      }

      const res = await productService.update(editingProductId, payload);
      setProdListMsg({ ok: true, text: res.message });
      setEditingProductId(null);
      setEditProductFile(null);
      setEditProductPreview(null);
      loadProducts();
    } catch (err) {
      setProdListMsg({ ok: false, text: err.message });
    }
  };

  const handleProdDelete = async (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}" de la tienda?`)) return;
    setProdListMsg(null);
    try {
      const res = await productService.remove(product.id);
      setProdListMsg({ ok: true, text: res.message });
      if (editingProductId === product.id) setEditingProductId(null);
      loadProducts();
    } catch (err) {
      setProdListMsg({ ok: false, text: err.message });
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
      setZoneForm({ name: '', price: '', capacity: '', tickets_for_sale: '', is_enabled: true });
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

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffMsg(null);
    setCreatingStaff(true);
    try {
      const res = await userService.create({
        ...staffForm,
        tenant_id: isSuperadmin ? staffForm.tenant_id : undefined,
      });
      setStaffMsg({ ok: true, text: res.message });
      setStaffForm({ full_name: '', email: '', password: '', role: 'sales_manager', tenant_id: '' });
      loadUsers();
    } catch (err) {
      setStaffMsg({ ok: false, text: err.message });
    } finally {
      setCreatingStaff(false);
    }
  };

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

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setSaasMsg(null);
    try {
      const res = await saasService.updateSettings(settingsForm);
      setSaasMsg({ ok: true, text: res.message || 'Configuración guardada.' });
      loadSaasSettings();
      loadSaasOverview();
    } catch (err) {
      setSaasMsg({ ok: false, text: err.message });
    }
  };

  const handleToggleTenant = async (tenant) => {
    setSaasMsg(null);
    try {
      await tenantService.update(tenant.id, { is_active: !tenant.is_active });
      setSaasMsg({ ok: true, text: `Club ${!tenant.is_active ? 'activado' : 'desactivado'}.` });
      loadTenants();
      loadSaasOverview();
    } catch (err) {
      setSaasMsg({ ok: false, text: err.message });
    }
  };

  const handleTenantSubscriptionChange = async (tenant, patch) => {
    setSaasMsg(null);
    try {
      await tenantService.update(tenant.id, patch);
      setSaasMsg({ ok: true, text: 'Suscripción actualizada.' });
      loadTenants();
      loadSaasOverview();
    } catch (err) {
      setSaasMsg({ ok: false, text: err.message });
    }
  };
  const updateDraftZone = (index, key, value) => setDraftZones(z => z.map((zone, i) => i === index ? { ...zone, [key]: value } : zone));
  const removeDraftZone = (index) => setDraftZones(z => z.filter((_, i) => i !== index));

  const handleMatchSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const zones = draftZones.filter(z => z.name.trim() || z.price !== '' || z.capacity !== '');
    const invalidZone = zones.find(z => !z.name.trim() || z.price === '' || z.capacity === '' || Number(z.price) < 0 || Number(z.capacity) < 1);
    if (invalidZone) {
      setMessage({ ok: false, text: 'Completa nombre, precio y aforo de cada zona (aforo mínimo 1).' });
      return;
    }

    try {
      let image_url = null;
      if (matchFile) {
        const uploaded = await uploadService.matchImage(matchFile);
        image_url = uploaded.data.url;
      }

      const payload = { ...form, stadium_name: form.stadium_name.trim() || myTenant?.stadium_name || '', image_url };
      const res = await matchService.createMatch(payload);
      const match = res.data;
      let zoneErrors = 0;
      for (const zone of zones) {
        try {
          await matchService.addZone(match.id, {
            name: zone.name.trim(),
            price: Number(zone.price),
            capacity: Number(zone.capacity),
            tickets_for_sale: zone.tickets_for_sale === '' ? Number(zone.capacity) : Number(zone.tickets_for_sale),
            is_enabled: zone.is_enabled !== false,
          });
        } catch {
          zoneErrors++;
        }
      }
      setMessage({
        ok: zoneErrors === 0,
        text: zoneErrors === 0
          ? `Partido publicado${zones.length ? ` con ${zones.length} zona(s)` : ''}.`
          : `Partido publicado, pero ${zoneErrors} zona(s) no se pudieron guardar.`
      });
      setForm(f => ({
        tenant_id: isSuperadmin ? f.tenant_id : '',
        opponent: '',
        competition: '',
        matchday: '',
        match_date: '',
        stadium_name: myTenant?.stadium_name || '',
      }));
      setDraftZones([]);
      if (matchPreview?.startsWith('blob:')) URL.revokeObjectURL(matchPreview);
      setMatchFile(null);
      setMatchPreview(null);
      loadAdminMatches();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  const handleEditStart = (m) => {
    setEditingMatchId(m.id);
    setEditForm({
      opponent: m.opponent || '',
      competition: m.competition || '',
      matchday: m.matchday ?? '',
      match_date: toLocalInput(m.match_date),
      stadium_name: m.stadium_name || '',
      status: m.status || 'scheduled',
    });
    setEditMatchFile(null);
    setEditMatchPreview(m.image_url || null);
    setMatchListMsg(null);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setMatchListMsg(null);
    const payload = { ...editForm };
    if (!String(payload.competition || '').trim()) delete payload.competition;
    if (String(payload.matchday ?? '').trim() === '') delete payload.matchday;
    try {
      if (editMatchFile) {
        const uploaded = await uploadService.matchImage(editMatchFile);
        payload.image_url = uploaded.data.url;
      } else if (editMatchPreview === null) {
        payload.image_url = null;
      }
      const res = await matchService.updateMatch(editingMatchId, payload);
      setMatchListMsg({ ok: true, text: res.message });
      setEditingMatchId(null);
      loadAdminMatches();
    } catch (err) {
      setMatchListMsg({ ok: false, text: err.message });
    }
  };

  const handleDeleteMatch = async (m) => {
    if (!window.confirm(`¿Eliminar el partido vs ${m.opponent}? Esta acción no se puede deshacer.`)) return;
    setMatchListMsg(null);
    try {
      const res = await matchService.deleteMatch(m.id);
      setMatchListMsg({ ok: true, text: res.message });
      if (zoneMatchId === m.id) {
        setZoneMatchId('');
        setZones([]);
      }
      if (editingMatchId === m.id) setEditingMatchId(null);
      loadAdminMatches();
    } catch (err) {
      setMatchListMsg({ ok: false, text: err.message });
    }
  };

  const handleManageZones = (matchId) => {
    setZoneMsg(null);
    setZoneMatchId(matchId);
    loadZones(matchId);
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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {myTenant && <ClubLogo name={myTenant.name} logoUrl={myTenant.logo_url} size="lg" />}
          <div>
            <span className="eyebrow">{myTenant ? 'Administración del club' : 'Administración general'}</span>
            <h2 className="section-title text-3xl mt-1">
              {myTenant ? myTenant.name : 'Panel de Administración'}
            </h2>
          </div>
        </div>
        {myTenant && (
          <Link to={`/club/${myTenant.slug}`} className="btn btn-outline py-2 px-4 text-sm">
            Ver mi espacio público
          </Link>
        )}
      </div>

      <nav className="flex gap-2 mt-8 border-b border-white/10 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${
              tab === t.id
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === 'resumen' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Entradas vendidas"
                value={`Bs ${ticketRevenue.toLocaleString()}`}
                sub={`${tickets.length} entrada(s) · ${ticketsUsed} ya escaneada(s)`}
              />
              <StatCard
                label="Ventas de tienda"
                value={`Bs ${storeRevenue.toLocaleString()}`}
                sub={`${pendingOrders} pedido(s) pendiente(s)`}
              />
              <StatCard
                label="Socios activos"
                value={activeMemberships.length}
                sub={`Bs ${membershipRevenue.toLocaleString()} / mes`}
              />
              <StatCard
                label="Partidos programados"
                value={upcomingMatches}
                sub={`${adminMatches.length} partido(s) en total`}
              />
            </div>

            {(ticketsError || ordersError || membershipsError) && (
              <p className="alert-error">
                {ticketsError || ordersError || membershipsError}
              </p>
            )}            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Últimos pedidos</h3>              </div>
              {orders.length === 0 ? (
                <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">No hay pedidos todavía.</p>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 4).map(o => (
                    <div key={o.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-bold">{o.products?.name} × {o.quantity}</p>
                        <p className="text-gray-400 text-xs">{o.users?.full_name || o.users?.email} · {new Date(o.created_at).toLocaleString()}</p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-700 text-gray-300'}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Próximos partidos</h3>              </div>
              {adminMatches.length === 0 ? (
                <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">Aún no hay partidos.</p>
              ) : (
                <div className="space-y-2">
                  {adminMatches.slice(0, 4).map(m => (
                    <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-bold">vs {m.opponent}</p>
                        <p className="text-gray-400 text-xs">{m.stadium_name} · {new Date(m.match_date).toLocaleString()}</p>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full uppercase font-semibold bg-gray-900 border border-gray-700 text-emerald-300">
                        {MATCH_STATUS_LABELS[m.status] || m.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'partidos' && (
          <div className="space-y-10">
            <div>
              <h3 className="text-xl font-semibold mb-3">Nuevo partido</h3>
              <form onSubmit={handleMatchSubmit} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                {isSuperadmin && (
                  <label className="md:col-span-2">
                    <span className={labelCls}>Club *</span>
                    <select
                      value={form.tenant_id}
                      onChange={e => {
                        const tenant = tenants.find(t => t.id === e.target.value);
                        setForm(f => ({ ...f, tenant_id: e.target.value, stadium_name: tenant?.stadium_name || f.stadium_name }));
                      }}
                      required
                      className={inputCls}
                    >
                      <option value="">Selecciona el club...</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <span className={labelCls}>Rival *</span>
                  <input type="text" placeholder="The Strongest" value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Competencia</span>
                  <input type="text" placeholder="Liga Profesional, Copa Libertadores..." value={form.competition} onChange={e => setForm({ ...form, competition: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Jornada</span>
                  <input type="number" min="1" step="1" placeholder="Ej. 12" value={form.matchday} onChange={e => setForm({ ...form, matchday: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Fecha y hora *</span>
                  <input type="datetime-local" min={minMatchDate()} value={form.match_date} onChange={e => setForm({ ...form, match_date: e.target.value })} required className={inputCls} />
                </label>
                <label className="md:col-span-2">
                  <span className={labelCls}>Estadio *</span>
                  <input type="text" placeholder="Estadio Hernando Siles" value={form.stadium_name || myTenant?.stadium_name || ''} onChange={e => setForm({ ...form, stadium_name: e.target.value })} required className={inputCls} />
                </label>

                <label className="md:col-span-2">
                  <span className={labelCls}>Imagen del partido</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-600 text-xs shrink-0">
                      {matchPreview ? <img src={matchPreview} alt="Vista previa" className="w-full h-full object-cover" /> : 'Sin imagen'}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickMatchImage} className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                      <span className="text-xs text-gray-500">PNG, JPG o WEBP · máximo 2 MB</span>
                    </div>
                    {matchPreview && (
                      <button type="button" onClick={clearMatchImage} className="text-xs text-red-400 hover:text-red-300">Quitar imagen</button>
                    )}
                  </div>
                </label>

                <div className="md:col-span-2 border-t border-gray-700 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-sm">Zonas y precios</p>
                      <p className="text-xs text-gray-500">Puedes crear las zonas ahora o gestionarlas después.</p>
                    </div>
                    <button type="button" onClick={addDraftZone} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">
                      + Agregar zona
                    </button>
                  </div>

                  {draftZones.length === 0 ? (
                    <p className="text-gray-500 text-sm">Sin zonas por ahora.</p>
                  ) : (
                    <div className="space-y-2">
                      {draftZones.map((zone, index) => (
<div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                          <label className="md:col-span-4">
                            <span className={labelCls}>Zona</span>
                            <input type="text" placeholder="Curva Sur, Butacas..." value={zone.name} onChange={e => updateDraftZone(index, 'name', e.target.value)} className={inputCls} />
                          </label>
                          <label className="md:col-span-2">
                            <span className={labelCls}>Precio Bs</span>
                            <input type="number" min="0" step="1" placeholder="50" value={zone.price} onChange={e => updateDraftZone(index, 'price', e.target.value)} className={inputCls} />
                          </label>
                          <label className="md:col-span-2">
                            <span className={labelCls}>Aforo</span>
                            <input type="number" min="1" step="1" placeholder="1000" value={zone.capacity} onChange={e => updateDraftZone(index, 'capacity', e.target.value)} className={inputCls} />
                          </label>
                          <label className="md:col-span-2">
                            <span className={labelCls}>A la venta</span>
                            <input type="number" min="0" step="1" placeholder="1000" value={zone.tickets_for_sale} onChange={e => updateDraftZone(index, 'tickets_for_sale', e.target.value)} className={inputCls} />
                          </label>
                          <label className="md:col-span-1 flex items-center gap-1 text-xs text-gray-300">
                            <input type="checkbox" checked={zone.is_enabled !== false} onChange={e => updateDraftZone(index, 'is_enabled', e.target.checked)} />
                            Hab.
                          </label>
                          <button type="button" onClick={() => removeDraftZone(index)} aria-label="Quitar zona" className="md:col-span-1 bg-red-800 hover:bg-red-700 text-white py-3 rounded-lg">×</button>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 text-right">
                        Aforo total: {draftZones.reduce((sum, z) => sum + (Number(z.capacity) || 0), 0).toLocaleString()} personas
                      </p>
                    </div>
                  )}
                </div>

                <button type="submit" className="md:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">Publicar partido</button>
              </form>
              <Notice msg={message} />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Partidos programados</h3>
              <Notice msg={matchListMsg} />
              {adminMatches.length === 0 ? (
                <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">Aún no hay partidos publicados.</p>
              ) : (
                <div className="space-y-3">
                  {adminMatches.map(m => (
                    <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm">
                      {editingMatchId === m.id ? (
                        <form onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label>
                            <span className={labelCls}>Rival *</span>
                            <input type="text" value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} required className={inputCls} />
                          </label>
                          <label>
                            <span className={labelCls}>Competencia</span>
                            <input type="text" value={editForm.competition} onChange={e => setEditForm({ ...editForm, competition: e.target.value })} className={inputCls} />
                          </label>
                          <label>
                            <span className={labelCls}>Jornada</span>
                            <input type="number" min="1" step="1" value={editForm.matchday} onChange={e => setEditForm({ ...editForm, matchday: e.target.value })} className={inputCls} />
                          </label>
                          <label>
                            <span className={labelCls}>Fecha y hora *</span>
                            <input type="datetime-local" value={editForm.match_date} onChange={e => setEditForm({ ...editForm, match_date: e.target.value })} required className={inputCls} />
                          </label>
                          <label>
                            <span className={labelCls}>Estadio *</span>
                            <input type="text" value={editForm.stadium_name} onChange={e => setEditForm({ ...editForm, stadium_name: e.target.value })} required className={inputCls} />
                          </label>
<label className="md:col-span-2">
                            <span className={labelCls}>Imagen del partido</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-600 text-xs shrink-0">
                                {editMatchPreview ? <img src={editMatchPreview} alt="Vista previa" className="w-full h-full object-cover" /> : 'Sin imagen'}
                              </div>
                              <div className="flex flex-col gap-1">
                                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickEditMatchImage} className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                              </div>
                              {editMatchPreview && (
                                <button type="button" onClick={clearEditMatchImage} className="text-xs text-red-400 hover:text-red-300">Quitar imagen</button>
                              )}
                            </div>
                          </label>
                          <label>
                            <span className={labelCls}>Estado</span>
                            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                              {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <div className="md:col-span-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingMatchId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancelar</button>
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition">Guardar cambios</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold">vs {m.opponent}</p>
                              {m.competition && (
                                <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-900 text-sky-300 border border-sky-800">{m.competition}</span>
                              )}
                              {m.matchday && (
                                <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-900 text-gray-300 border border-gray-700">Jornada {m.matchday}</span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-1">
                              {formatMatchDate(m.match_date)} · {m.stadium_name}
                              {isSuperadmin && m.tenants?.name ? ` · ${m.tenants.name}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs px-3 py-1 rounded-full uppercase font-semibold bg-gray-900 border border-gray-700 text-emerald-300">
                              {MATCH_STATUS_LABELS[m.status] || m.status}
                            </span>
                            <button type="button" onClick={() => handleManageZones(m.id)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition">Zonas</button>
                            <button type="button" onClick={() => handleEditStart(m)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Editar</button>
                            <button type="button" onClick={() => handleDeleteMatch(m)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Zonas por partido</h3>
              <Notice msg={zoneMsg} />
              <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 space-y-4">
                <label className="block">
                  <span className={labelCls}>Selecciona un partido</span>
                  <select value={zoneMatchId} onChange={e => handleZoneMatchChange(e.target.value)} className={inputCls}>
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
                          <span>
                            <span className="font-bold">{z.name}</span> · Bs {z.price} · aforo {z.capacity} · a la venta {z.tickets_for_sale ?? z.capacity} · vendidas {z.sold ?? 0} · disponibles {z.available ?? 0}
                            {!z.is_enabled && <span className="ml-2 text-red-400 font-semibold">(deshabilitada)</span>}
                          </span>
                          <button type="button" onClick={() => handleZoneDelete(z.id)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleZoneSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border-t border-gray-700 pt-4">
                      <label className="md:col-span-2">
                        <span className={labelCls}>Nombre (Curva Sur, Butacas...)</span>
                        <input type="text" value={zoneForm.name} onChange={e => setZoneForm({ ...zoneForm, name: e.target.value })} required className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Precio Bs</span>
                        <input type="number" min="0" step="1" value={zoneForm.price} onChange={e => setZoneForm({ ...zoneForm, price: e.target.value })} required className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>Aforo</span>
                        <input type="number" min="1" step="1" value={zoneForm.capacity} onChange={e => setZoneForm({ ...zoneForm, capacity: e.target.value })} required className={inputCls} />
                      </label>
                      <label>
                        <span className={labelCls}>A la venta</span>
                        <input type="number" min="0" step="1" value={zoneForm.tickets_for_sale} onChange={e => setZoneForm({ ...zoneForm, tickets_for_sale: e.target.value })} className={inputCls} />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" checked={zoneForm.is_enabled !== false} onChange={e => setZoneForm({ ...zoneForm, is_enabled: e.target.checked })} />
                        Habilitada
                      </label>
                      <button type="submit" className="md:col-span-5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg">Agregar zona</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'tienda' && (
          <div className="space-y-10">
            <div>
              <h3 className="text-xl font-semibold mb-3">Productos de la tienda</h3>
              <Notice msg={prodMsg} />
              <form onSubmit={handleProdSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
                <label className="md:col-span-2">
                  <span className={labelCls}>Nombre *</span>
                  <input type="text" placeholder="Camiseta oficial 2026" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Categoría</span>
                  <input type="text" placeholder="Camisetas, Bufandas..." value={prodForm.category} onChange={e => setProdForm({ ...prodForm, category: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Precio Bs *</span>
                  <input type="number" min="0" step="1" value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Stock *</span>
                  <input type="number" min="0" step="1" value={prodForm.stock} onChange={e => setProdForm({ ...prodForm, stock: e.target.value })} required className={inputCls} />
                </label>
                <label className="md:col-span-3">
                  <span className={labelCls}>Descripción</span>
                  <input type="text" placeholder="Detalles del producto" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className={inputCls} />
                </label>
                <label className="md:col-span-4">
                  <span className={labelCls}>Imagen</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-600 text-xs shrink-0">
                      {prodPreview ? <img src={prodPreview} alt="Vista previa" className="w-full h-full object-cover" /> : 'Sin imagen'}
                    </div>
                    <div className="flex flex-col gap-1">
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickProdImage} className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                      <span className="text-xs text-gray-500">PNG, JPG o WEBP · máximo 2 MB</span>
                    </div>
                    {prodPreview && (
                      <button type="button" onClick={clearProdImage} className="text-xs text-red-400 hover:text-red-300">Quitar imagen</button>
                    )}
                  </div>
                </label>
                {isSuperadmin && (
                  <label className="md:col-span-2">
                    <span className={labelCls}>Club *</span>
                    <select value={prodForm.tenant_id} onChange={e => setProdForm({ ...prodForm, tenant_id: e.target.value })} required className={inputCls}>
                      <option value="">Selecciona...</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="submit" className={`${isSuperadmin ? 'md:col-span-2' : 'md:col-span-4'} bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg`}>Agregar producto</button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-sm text-gray-400">{myProducts.length} producto(s) en la tienda</p>
                <input type="search" placeholder="Buscar por nombre o categoría..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className={`${inputCls} max-w-xs`} />
              </div>
              <Notice msg={prodListMsg} />

              <div className="space-y-3">
                {visibleProducts.length === 0 && (
                  <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">
                    {myProducts.length === 0 ? 'No hay productos todavía.' : 'No hay productos que coincidan con la búsqueda.'}
                  </p>
                )}
                {visibleProducts.map(p => (
                  <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm">
                    {editingProductId === p.id ? (
                      <form onSubmit={handleProdUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <label className="md:col-span-2">
                          <span className={labelCls}>Nombre *</span>
                          <input type="text" value={editProductForm.name} onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })} required className={inputCls} />
                        </label>
                        <label>
                          <span className={labelCls}>Categoría</span>
                          <input type="text" value={editProductForm.category} onChange={e => setEditProductForm({ ...editProductForm, category: e.target.value })} className={inputCls} />
                        </label>
                        <label>
                          <span className={labelCls}>Precio Bs *</span>
                          <input type="number" min="0" step="1" value={editProductForm.price} onChange={e => setEditProductForm({ ...editProductForm, price: e.target.value })} required className={inputCls} />
                        </label>
                        <label>
                          <span className={labelCls}>Stock *</span>
                          <input type="number" min="0" step="1" value={editProductForm.stock} onChange={e => setEditProductForm({ ...editProductForm, stock: e.target.value })} required className={inputCls} />
                        </label>
                        <label className="md:col-span-3">
                          <span className={labelCls}>Descripción</span>
                          <input type="text" value={editProductForm.description} onChange={e => setEditProductForm({ ...editProductForm, description: e.target.value })} className={inputCls} />
                        </label>
                        <label className="md:col-span-4">
                          <span className={labelCls}>Imagen</span>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-600 text-xs shrink-0">
                              {editProductPreview ? <img src={editProductPreview} alt="Vista previa" className="w-full h-full object-cover" /> : 'Sin imagen'}
                            </div>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickEditProductImage} className="text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white hover:file:bg-gray-600" />
                            {editProductFile && (
                              <button type="button" onClick={clearEditProductImage} className="text-xs text-red-400 hover:text-red-300">Descartar cambio</button>
                            )}
                          </div>
                        </label>
                        <div className="md:col-span-4 flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingProductId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">Cancelar</button>
                          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg transition">Guardar cambios</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              p.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold">{p.name}</p>
                              {p.category && (
                                <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-900 text-sky-300 border border-sky-800">{p.category}</span>
                              )}
                              <span className={`text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                p.stock === 0
                                  ? 'bg-red-900 text-red-300 border-red-800'
                                  : p.stock <= 5
                                    ? 'bg-yellow-900 text-yellow-300 border-yellow-800'
                                    : 'bg-emerald-900 text-emerald-300 border-emerald-800'
                              }`}>
                                {p.stock === 0 ? 'Agotado' : p.stock <= 5 ? `Stock bajo: ${p.stock}` : `Stock: ${p.stock}`}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">
                              {p.tenants?.name}{p.description ? ` · ${p.description}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-emerald-400 font-semibold">Bs {Number(p.price).toLocaleString('es-BO')}</span>
                          <button type="button" onClick={() => handleProdEditStart(p)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Editar</button>
                          <button type="button" onClick={() => handleProdDelete(p)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg transition">Eliminar</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Pedidos de la tienda</h3>
              <Notice msg={ordersError ? { ok: false, text: ordersError } : null} />
              <div className="flex flex-wrap gap-2 mb-4">
                {['all', 'pending', 'paid', 'shipped', 'cancelled'].map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setOrderFilter(status)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      orderFilter === status
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                    }`}
                  >
                    {status === 'all' ? 'Todos' : STATUS_LABELS[status]} ({orderCount(status)})
                  </button>
                ))}
              </div>
              {visibleOrders.length === 0 && !ordersError && (
                <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">
                  {orders.length === 0 ? 'No hay pedidos todavía.' : 'No hay pedidos con ese estado.'}
                </p>
              )}
              <div className="space-y-3">
                {visibleOrders.map(o => (
                  <div key={o.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                        {o.products?.image_url ? (
                          <img src={o.products.image_url} alt={o.products.name} className="w-full h-full object-cover" />
                        ) : (
                          (o.products?.name || '?').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-bold">{o.products?.name} × {o.quantity}</p>
                        <p className="text-gray-400 text-xs">{o.users?.full_name || o.users?.email} · {o.tenants?.name} · {new Date(o.created_at).toLocaleString()}</p>
                        <p className="text-emerald-400 font-semibold mt-1">Bs {Number(o.total).toLocaleString('es-BO')}</p>
                      </div>
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
          </div>
        )}

        {tab === 'socios' && (
          <div className="space-y-10">
            <div>
              <h3 className="text-xl font-semibold mb-3">Planes de socio</h3>
              <Notice msg={planMsg} />
              <form onSubmit={handlePlanSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
                <label>
                  <span className={labelCls}>Nombre (Socio Dorado...)</span>
                  <input type="text" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Precio mensual Bs</span>
                  <input type="number" min="0" step="1" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} required className={inputCls} />
                </label>
                <label className="md:col-span-2">
                  <span className={labelCls}>Beneficios</span>
                  <input type="text" value={planForm.benefits} onChange={e => setPlanForm({ ...planForm, benefits: e.target.value })} className={inputCls} />
                </label>
                {isSuperadmin && (
                  <label className="md:col-span-3">
                    <span className={labelCls}>Club</span>
                    <select value={planForm.tenant_id} onChange={e => setPlanForm({ ...planForm, tenant_id: e.target.value })} required className={inputCls}>
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

            <div>
              <h3 className="text-xl font-semibold mb-3">Socios del club</h3>
              <Notice msg={membershipsError ? { ok: false, text: membershipsError } : null} />
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
          </div>
        )}

        {tab === 'pedidos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Pedidos</h3>
            </div>
            <Notice msg={ordersError ? { ok: false, text: ordersError } : null} />
            <div className="flex flex-wrap gap-2 mb-4">
              {['all', 'pending', 'paid', 'shipped', 'cancelled'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setOrderFilter(status)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    orderFilter === status
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                  }`}
                >
                  {status === 'all' ? 'Todos' : STATUS_LABELS[status]} ({orderCount(status)})
                </button>
              ))}
            </div>
            {visibleOrders.length === 0 && !ordersError && (
              <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">
                {orders.length === 0 ? 'No hay pedidos todavía.' : 'No hay pedidos con ese estado.'}
              </p>
            )}
            <div className="space-y-3">
              {visibleOrders.map(o => (
                <div key={o.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-900 border border-gray-700 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                      {o.products?.image_url ? (
                        <img src={o.products.image_url} alt={o.products.name} className="w-full h-full object-cover" />
                      ) : (
                        (o.products?.name || '?').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-bold">{o.products?.name} × {o.quantity}</p>
                      <p className="text-gray-400 text-xs">{o.users?.full_name || o.users?.email} · {o.tenants?.name} · {new Date(o.created_at).toLocaleString()}</p>
                      <p className="text-emerald-400 font-semibold mt-1">Bs {Number(o.total).toLocaleString('es-BO')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-700 text-gray-300'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    {o.status === 'paid' && (
                      <button type="button" onClick={() => handleStatus(o.id, 'shipped')} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Despachar</button>
                    )}
                    {o.status === 'pending' && (
                      <>
                        <button type="button" onClick={() => handleStatus(o.id, 'paid')} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Marcar pagado</button>
                        <button type="button" onClick={() => handleStatus(o.id, 'cancelled')} className="bg-red-800 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">Cancelar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reportes' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Entradas vendidas" value={`Bs ${ticketRevenue.toLocaleString()}`} sub={`${tickets.length} entrada(s) · ${ticketsUsed} ya escaneada(s)`} />
              <StatCard label="Ventas de tienda" value={`Bs ${storeRevenue.toLocaleString()}`} sub={`${pendingOrders} pedido(s) pendiente(s)`} />
              <StatCard label="Socios activos" value={activeMemberships.length} sub={`Bs ${membershipRevenue.toLocaleString()} / mes`} />
              <StatCard label="Partidos programados" value={upcomingMatches} sub={`${adminMatches.length} partido(s) en total`} />
            </div>
          </div>
        )}

        {tab === 'mi-club' && myTenant && (
          <ClubProfileForm key={myTenant.id} tenant={myTenant} onSaved={loadTenants} />
        )}

        {tab === 'clubes' && isSuperadmin && (
          <div>
            <h3 className="text-xl font-semibold mb-3">Gestión de clubes</h3>
            <Notice msg={tenantError ? { ok: false, text: tenantError } : null} />
            <Notice msg={tenantOk ? { ok: true, text: tenantOk } : null} />
            <form onSubmit={handleTenantSubmit} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 flex flex-wrap gap-3 items-end mb-4">
              <label className="flex-1 min-w-40">
                <span className={labelCls}>Nombre del club</span>
                <input type="text" value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} required className={inputCls} />
              </label>
              <label className="flex-1 min-w-40">
                <span className={labelCls}>Slug (identificador corto)</span>
                <input type="text" value={tenantForm.slug} onChange={e => setTenantForm({ ...tenantForm, slug: e.target.value })} required pattern="[a-z0-9-]+" className={inputCls} />
              </label>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg">Crear Club</button>
            </form>
            <div className="space-y-3">
              {tenants.map(t => (
                <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ClubLogo name={t.name} logoUrl={t.logo_url} size="sm" />
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
                    </div>
                  </div>
                  <Link to={`/club/${t.slug}`} className="btn btn-outline py-1.5 px-3 text-xs">
                    Ver espacio
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

{tab === 'plataforma' && isSuperadmin && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-3">Panel Multi-Tenant SaaS</h3>
              <Notice msg={saasMsg} />
              {saasOverview?.totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <StatCard label="Clubes" value={saasOverview.totals.clubs} sub={`${saasOverview.totals.active_clubs} activos`} />
                  <StatCard label="Partidos" value={saasOverview.totals.matches} />
                  <StatCard label="Entradas vendidas" value={saasOverview.totals.tickets_sold} sub={`Bs ${saasOverview.totals.ticket_revenue}`} />
                  <StatCard label="Ingresos totales" value={`Bs ${saasOverview.totals.total_revenue}`} sub={`${saasOverview.totals.orders_count} pedidos tienda`} />
                </div>
              )}
            </div>

            <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700">
              <h4 className="font-semibold mb-3">Configuración global de pasarela de pago y comisiones</h4>
              <form onSubmit={handleSettingsSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <label>
                  <span className={labelCls}>Proveedor de pago</span>
                  <input type="text" value={settingsForm.payment_provider} onChange={e => setSettingsForm({ ...settingsForm, payment_provider: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Moneda</span>
                  <input type="text" value={settingsForm.currency} onChange={e => setSettingsForm({ ...settingsForm, currency: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Clave pública</span>
                  <input type="text" value={settingsForm.payment_public_key} onChange={e => setSettingsForm({ ...settingsForm, payment_public_key: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Clave secreta (dejar vacío para mantener)</span>
                  <input type="password" value={settingsForm.payment_secret_key} onChange={e => setSettingsForm({ ...settingsForm, payment_secret_key: e.target.value })} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Comisión SaaS global (%)</span>
                  <input type="number" min="0" max="100" step="0.01" value={settingsForm.platform_commission_rate} onChange={e => setSettingsForm({ ...settingsForm, platform_commission_rate: e.target.value })} className={inputCls} />
                </label>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">Guardar configuración</button>
              </form>
            </div>

<div>
              <h4 className="font-semibold mb-3">Clubes afiliados y volumen de ventas</h4>
              <div className="space-y-3">
                {(saasOverview?.tenants || []).map(t => (
                  <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{t.name}</p>
                        <p className="text-xs text-gray-400">slug: {t.slug} · {t.is_active ? 'Activo' : 'Inactivo'} · plan {t.subscription_plan} · {t.subscription_status}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleToggleTenant(t)} className={`${t.is_active ? 'bg-red-700 hover:bg-red-600' : 'bg-emerald-700 hover:bg-emerald-600'} text-white text-xs px-3 py-1.5 rounded-lg`}>
                          {t.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                      <div className="bg-gray-900 rounded p-2"><span className="text-gray-500">Partidos</span><p className="font-bold">{t.matches_count}</p></div>
                      <div className="bg-gray-900 rounded p-2"><span className="text-gray-500">Entradas</span><p className="font-bold">{t.tickets_sold}</p></div>
                      <div className="bg-gray-900 rounded p-2"><span className="text-gray-500">Rev. entradas</span><p className="font-bold">Bs {t.ticket_revenue}</p></div>
                      <div className="bg-gray-900 rounded p-2"><span className="text-gray-500">Pedidos tienda</span><p className="font-bold">{t.orders_count}</p></div>
                      <div className="bg-gray-900 rounded p-2"><span className="text-gray-500">Rev. total</span><p className="font-bold">Bs {t.total_revenue}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-end">
                      <label className="min-w-32">
                        <span className={labelCls}>Estado suscripción</span>
                        <select value={t.subscription_status} onChange={e => handleTenantSubscriptionChange(t, { subscription_status: e.target.value })} className={inputCls}>
                          <option value="trial">Prueba</option>
                          <option value="active">Activa</option>
                          <option value="suspended">Suspendida</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      </label>
                      <label className="min-w-32">
                        <span className={labelCls}>Plan</span>
                        <input type="text" defaultValue={t.subscription_plan} onBlur={e => handleTenantSubscriptionChange(t, { subscription_plan: e.target.value })} className={inputCls} />
                      </label>
                      <label className="min-w-32">
                        <span className={labelCls}>Comisión override (%)</span>
                        <input type="number" min="0" max="100" step="0.01" defaultValue={t.commission_rate ?? ''} onBlur={e => handleTenantSubscriptionChange(t, { commission_rate: e.target.value === '' ? null : e.target.value })} className={inputCls} />
                      </label>
                    </div>
                  </div>
                ))}
                {(!saasOverview?.tenants || saasOverview.tenants.length === 0) && (
                  <p className="text-gray-400 text-sm">No hay clubes registrados.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'usuarios' && (
          <div className="space-y-10">
            <div>
              <h3 className="text-xl font-semibold mb-1">{isSuperadmin ? 'Usuarios y roles' : 'Personal del club'}</h3>
              <p className="text-sm text-gray-400 mb-4">
                {isSuperadmin
                  ? 'Crea cuentas y asigna roles en cualquier club.'
                  : 'Crea cuentas para tu personal. Cada rol accede solo a lo que le corresponde.'}
              </p>
              <Notice msg={staffMsg} />
              <form onSubmit={handleCreateStaff} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-3 items-end mb-4">
                <label>
                  <span className={labelCls}>Nombre completo</span>
                  <input type="text" value={staffForm.full_name} onChange={e => setStaffForm({ ...staffForm, full_name: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Email</span>
                  <input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} required className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Contraseña inicial</span>
                  <input type="password" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} required minLength={8} className={inputCls} />
                  <span className="text-xs text-gray-500 mt-1 block">Mínimo 8 caracteres, una mayúscula, una minúscula y un número.</span>
                </label>
                <label>
                  <span className={labelCls}>Rol</span>
                  <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className={inputCls}>
                    {roleOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                {isSuperadmin && (
                  <label className="md:col-span-2">
                    <span className={labelCls}>Club</span>
                    <select value={staffForm.tenant_id} onChange={e => setStaffForm({ ...staffForm, tenant_id: e.target.value })} className={inputCls}>
                      <option value="">Sin club (solo hincha)</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="submit" disabled={creatingStaff} className="md:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg disabled:opacity-60">
                  {creatingStaff ? 'Creando...' : 'Crear usuario'}
                </button>
              </form>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-3">Cambiar rol</h4>
              <Notice msg={assignMsg} />
              <form onSubmit={handleAssign} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-4">
                <label className="md:col-span-2">
                  <span className={labelCls}>Usuario</span>
                  <select value={assignForm.user_id} onChange={e => setAssignForm({ ...assignForm, user_id: e.target.value })} required className={inputCls}>
                    <option value="">Selecciona un usuario...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelCls}>Nuevo rol</span>
                  <select value={assignForm.role} onChange={e => setAssignForm({ ...assignForm, role: e.target.value })} required className={inputCls}>
                    <option value="">Selecciona rol...</option>
                    {roleOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg">Asignar</button>
                {isSuperadmin && (
                  <label className="md:col-span-4">
                    <span className={labelCls}>Club (obligatorio para roles de club; déjalo vacío para superadmin/hincha)</span>
                    <select value={assignForm.tenant_id} onChange={e => setAssignForm({ ...assignForm, tenant_id: e.target.value })} className={inputCls}>
                      <option value="">Sin club</option>
                      {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </form>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-3">{isSuperadmin ? 'Todos los usuarios' : 'Mi personal'}</h4>
              {users.length === 0 ? (
                <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">
                  {isSuperadmin ? 'No hay usuarios.' : 'Aún no has creado personal para tu club.'}
                </p>
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClubProfileForm({ tenant, onSaved }) {
  const [form, setForm] = useState({
    name: tenant.name || '',
    stadium_name: tenant.stadium_name || '',
    stadium_capacity: tenant.stadium_capacity || '',
    department: tenant.department || '',
    personeria: tenant.personeria || '',
    run_code: tenant.run_code || '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMsg(null);
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setMsg({ ok: false, text: 'Formato no permitido. Sube una imagen PNG, JPG o WEBP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ ok: false, text: 'La imagen supera el máximo de 2 MB.' });
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      let logo_url = tenant.logo_url || null;
      if (logoFile) {
        const upload = await uploadService.clubLogo(logoFile);
        logo_url = upload.data.url;
      }

      const res = await tenantService.update(tenant.id, { ...form, logo_url });
      setMsg({ ok: true, text: res.message });
      setLogoFile(null);
      setLogoPreview(null);
      onSaved?.();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-3">Perfil del club</h3>
      <p className="text-sm text-gray-400 mb-5">
        Estos datos aparecen en tu espacio público. La dirección web es{' '}
        <Link to={`/club/${tenant.slug}`} className="text-emerald-400 underline">/club/{tenant.slug}</Link>.
      </p>
      <Notice msg={msg} />
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
        <div>
          <span className={labelCls}>Escudo del club</span>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border border-white/15 bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Vista previa del escudo" className="w-full h-full object-contain p-1" />
              ) : (
                <ClubLogo name={tenant.name} logoUrl={tenant.logo_url} size="md" className="border-0" />
              )}
            </div>
            <div className="flex-1">
              <label className="btn btn-outline py-2 px-4 text-sm cursor-pointer inline-flex">
                {logoFile ? 'Cambiar imagen' : 'Subir imagen'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} className="hidden" />
              </label>
              <p className="text-xs text-gray-500 mt-2">PNG, JPG o WEBP · máximo 2 MB</p>
              {logoFile && (
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  className="text-xs text-red-400 hover:text-red-300 underline mt-1"
                >
                  Quitar imagen
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="block">
          <span className={labelCls}>Nombre del club</span>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>
            <span className={labelCls}>Estadio</span>
            <input type="text" value={form.stadium_name} onChange={e => setForm({ ...form, stadium_name: e.target.value })} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Capacidad</span>
            <input type="number" min="1" step="1" value={form.stadium_capacity} onChange={e => setForm({ ...form, stadium_capacity: e.target.value })} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Departamento</span>
            <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Personería jurídica</span>
            <input type="text" value={form.personeria} onChange={e => setForm({ ...form, personeria: e.target.value })} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Código RUN</span>
            <input type="text" value={form.run_code} onChange={e => setForm({ ...form, run_code: e.target.value })} className={inputCls} />
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full py-3 disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

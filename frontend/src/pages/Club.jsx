import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tenantService } from '../api/tenant.service';
import { matchService } from '../api/match.service';
import { productService } from '../api/product.service';
import { orderService } from '../api/order.service';
import { membershipService } from '../api/membership.service';
import { useAuth } from '../context/auth-context';
import ClubLogo from '../components/ClubLogo';

const TABS = [
  { id: 'partidos', label: 'Partidos' },
  { id: 'tienda', label: 'Tienda' },
  { id: 'socios', label: 'Socios' },
];

export default function Club() {
  const { slug } = useParams();
  return <ClubSpace key={slug} slug={slug} />;
}

function ClubSpace({ slug }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [matches, setMatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [tab, setTab] = useState('partidos');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;

    tenantService
      .getBySlug(slug)
      .then(async res => {
        const t = res.data;
        if (!alive) return;
        setTenant(t);

        const [m, p, pl] = await Promise.allSettled([
          matchService.getAllMatches(`?tenant_id=${encodeURIComponent(t.id)}`),
          productService.getAll(`?tenant_id=${encodeURIComponent(t.id)}`),
          membershipService.getPlans(t.id),
        ]);

        if (!alive) return;
        if (m.status === 'fulfilled' && m.value.status === 'success') setMatches(m.value.data);
        if (p.status === 'fulfilled' && p.value.success) setProducts(p.value.data);
        if (pl.status === 'fulfilled' && pl.value.status === 'success') setPlans(pl.value.data);
      })
      .catch(err => {
        if (!alive) return;
        if (/no encontrado/i.test(err.message)) setNotFound(true);
        else setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [slug]);

  const buy = async (product, qty) => {
    if (!token) return navigate('/login');
    setBusy(`product-${product.id}`);
    setError(null);
    try {
      const res = await orderService.create({ product_id: product.id, quantity: qty });
      if (res.success) navigate('/mis-pedidos', { state: { message: res.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const subscribe = async plan => {
    if (!token) return navigate('/login');
    setBusy(`plan-${plan.id}`);
    setError(null);
    try {
      const res = await membershipService.subscribe(plan.id);
      if (res.status === 'success') navigate('/mis-socio', { state: { message: res.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-16">Entrando al club...</p>;
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="card p-10 text-center">
          <h2 className="section-title text-2xl">Club no encontrado</h2>
          <p className="text-gray-400 mt-2">El espacio que buscas no existe o cambió de dirección.</p>
          <Link to="/" className="btn btn-primary mt-6">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <p className="text-center text-gray-400 py-16">{error || 'No se pudo cargar el club.'}</p>;
  }

  const canManage = user && (user.role === 'superadmin' || (user.tenant_id && user.tenant_id === tenant.id));
  const isClubAdmin = user && user.tenant_id === tenant.id;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <section className="relative rounded-3xl overflow-hidden border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800/50 via-[#0d141c] to-black" />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row gap-6 md:items-center">
          <ClubLogo name={tenant.name} logoUrl={tenant.logo_url} size="xl" />
          <div className="flex-1">
            <span className="eyebrow">Espacio del club</span>
            <h1 className="section-title text-3xl md:text-4xl mt-1">{tenant.name}</h1>
            <div className="flex flex-wrap gap-2 mt-4">
              {tenant.stadium_name && (
                <span className="badge">{tenant.stadium_name}</span>
              )}
              {tenant.stadium_capacity && (
                <span className="badge">{Number(tenant.stadium_capacity).toLocaleString()} espectadores</span>
              )}
              {tenant.department && <span className="badge">{tenant.department}</span>}
              {tenant.associations?.name && <span className="badge">{tenant.associations.name}</span>}
            </div>
            {(tenant.personeria || tenant.run_code) && (
              <p className="text-xs text-gray-500 mt-3">
                {tenant.personeria && <>Personería jurídica: {tenant.personeria}. </>}
                {tenant.run_code && <>RUN: {tenant.run_code}.</>}
              </p>
            )}
          </div>
          {canManage && (
            <Link to="/admin" className="btn btn-primary shrink-0">
              {isClubAdmin ? 'Panel del club' : 'Panel general'}
            </Link>
          )}
        </div>
      </section>

      <nav className="flex gap-2 mt-8 border-b border-white/10 overflow-x-auto">
        {TABS.map(t => (
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
            {t.id === 'partidos' && matches.length > 0 && ` (${matches.length})`}
            {t.id === 'tienda' && products.length > 0 && ` (${products.length})`}
            {t.id === 'socios' && plans.length > 0 && ` (${plans.length})`}
          </button>
        ))}
      </nav>

      {error && <p className="mt-4 alert-error">{error}</p>}

      {tab === 'partidos' && (
        <div className="mt-6">
          {matches.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              Este club aún no tiene partidos publicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {matches.map(m => (
                <article key={m.id} className="card card-hover p-6 flex flex-col">
                  <div className="flex flex-wrap gap-2 self-start">
                    <span className="badge">{m.status}</span>
                    {m.competition && <span className="badge">{m.competition}</span>}
                    {m.matchday && <span className="badge">Jornada {m.matchday}</span>}
                  </div>
                  <h3 className="font-display text-xl font-bold mt-3">{m.opponent}</h3>
                  <p className="text-sm text-gray-400 mt-1">{m.stadium_name}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(m.match_date).toLocaleString()}</p>
                  <Link to={`/comprar/${m.id}`} className="btn btn-primary mt-5 w-full">
                    Comprar entradas
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'tienda' && (
        <div className="mt-6">
          {products.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              La tienda de este club todavía no tiene productos.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  token={token}
                  busy={busy === `product-${p.id}`}
                  onBuy={buy}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'socios' && (
        <div className="mt-6">
          {plans.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              Este club aún no ofrece planes de membresía.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan.id} className="card card-hover p-6 flex flex-col">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-emerald-400 font-bold text-2xl mt-2">
                    Bs {plan.price}<span className="text-sm text-gray-400 font-normal">/mes</span>
                  </p>
                  <p className="text-sm text-gray-300 mt-3 flex-1">{plan.benefits}</p>
                  <button
                    type="button"
                    disabled={busy === `plan-${plan.id}`}
                    onClick={() => subscribe(plan)}
                    className="btn btn-primary mt-5 w-full py-2.5"
                  >
                    {busy === `plan-${plan.id}` ? 'Procesando...' : token ? 'Asociarme' : 'Inicia sesión'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!token && (
        <p className="mt-8 p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link>{' '}
          para comprar entradas, productos o asociarte al club.
        </p>
      )}
    </div>
  );
}

function ProductCard({ product, token, busy, onBuy }) {
  const [qty, setQty] = useState(1);
  const max = Math.min(product.stock, 5);

  return (
    <div className="card card-hover p-6 flex flex-col">
      <div className="h-36 bg-black/40 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="text-gray-600 text-sm">Sin imagen</span>
        )}
      </div>
      <h3 className="text-xl font-bold">{product.name}</h3>
      <p className="text-sm text-gray-400 mt-1 flex-1">{product.description}</p>
      <p className="text-emerald-400 font-bold text-2xl mt-3">Bs {product.price}</p>
      <p className="text-xs text-gray-500 mt-1">Stock: {product.stock}</p>

      <div className="flex items-center justify-between mt-4 gap-3">
        <div className="flex gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setQty(n)}
              className={`w-9 h-9 rounded-lg font-bold transition ${
                qty === n ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-300 border border-gray-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || product.stock < 1}
          onClick={() => onBuy(product, qty)}
          className="btn btn-primary py-2 px-5 text-sm"
        >
          {busy ? '...' : product.stock < 1 ? 'Agotado' : token ? 'Comprar' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}

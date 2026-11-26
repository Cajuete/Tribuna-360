import AlertBanner from '../components/AlertBanner';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart, Trophy } from 'lucide-react';
import { tenantService } from '../api/tenant.service';
import { productService } from '../api/product.service';
import { membershipService } from '../api/membership.service';
import { paymentService } from '../api/payment.service';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import ClubLogo from '../components/ClubLogo';
import ProductImage from '../components/ProductImage';
import FollowClubButton from '../components/FollowClubButton';
import CampaignBanners from '../components/CampaignBanners';
import SponsorStrip from '../components/SponsorStrip';
import { useCampaigns } from '../hooks/useCampaigns';

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
  const { token, user } = useAuth();
  const { cart, addToCart } = useCart();
  const navigate = useNavigate();
  const canShop = !token || user?.role === 'fan';
  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [tenant, setTenant] = useState(null);
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [tab, setTab] = useState('partidos');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const { campaigns, discountsByProduct, loading: campaignsLoading, error: campaignsError } = useCampaigns({
    placement: 'club',
    enabled: Boolean(tenant?.id),
  });

  useEffect(() => {
    let alive = true;

    tenantService
      .getBySlug(slug)
      .then(async res => {
        const t = res.data;
        if (!alive) return;
        setTenant(t);

        const [p, pl] = await Promise.allSettled([
          productService.getAll(`?tenant_id=${encodeURIComponent(t.id)}`),
          membershipService.getPlans(t.id),
        ]);

        if (!alive) return;
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

  useEffect(() => {
    let active = true;
    if (!token || user?.role !== 'fan' || !tenant?.id) {
      setFollowing(false);
      return () => { active = false; };
    }

    tenantService.getFollowed()
      .then(response => {
        if (active && response.status === 'success') {
          setFollowing(response.data.includes(tenant.id));
        }
      })
      .catch(error => {
        if (active) setError(error.message);
      });

    return () => { active = false; };
  }, [tenant?.id, token, user?.role]);

  const toggleFollow = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'fan' || !tenant) return;

    setFollowBusy(true);
    setError(null);
    try {
      const response = following
        ? await tenantService.unfollow(tenant.id)
        : await tenantService.follow(tenant.id);
      setFollowing(response.data.following);
      setTenant(current => ({ ...current, follower_count: response.data.follower_count }));
    } catch (followError) {
      setError(followError.message);
    } finally {
      setFollowBusy(false);
    }
  };

  const addProductToCart = (product, qty) => {
    if (!token) return navigate('/login');
    if (user?.role !== 'fan') return;
    const addError = addToCart(product, qty);
    setError(addError);
    return addError;
  };

  const subscribe = async plan => {
    if (!token) return navigate('/login');
    if (user?.role !== 'fan') return;
    setBusy(`plan-${plan.id}`);
    setError(null);
    try {
      const res = await paymentService.create('membership', { plan_id: plan.id });
      if (res.success) navigate(`/pagar/${res.data.id}`);
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
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {(!token || user?.role === 'fan') && (
                <FollowClubButton
                  following={following}
                  loading={followBusy}
                  onClick={toggleFollow}
                />
              )}
              <span className="text-sm text-slate-300">
                <strong className="text-white">{Number(tenant.follower_count || 0).toLocaleString('es-BO')}</strong>
                {Number(tenant.follower_count) === 1 ? ' hincha apoya a este club' : ' hinchas apoyan a este club'}
              </span>
            </div>
            {tenant.trophies_count > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-600/50 px-4 py-2 rounded-xl text-emerald-300 font-semibold text-sm">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <span>{tenant.trophies_count} Títulos / Trofeos oficiales</span>
                {tenant.trophies_list && <span className="text-xs text-emerald-400/80 font-normal">({tenant.trophies_list})</span>}
              </div>
            )}
          </div>
        </div>
      </section>

      <CampaignBanners campaigns={campaigns} placement="club" loading={campaignsLoading} error={campaignsError} />
      <SponsorStrip tenantId={tenant.id} />

      {tenant.short_history && (
        <section className="mt-8 card p-6 md:p-8 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Historia y Trayectoria</h2>
          <p className="text-slate-300 leading-relaxed font-medium">{tenant.short_history}</p>
        </section>
      )}

      <nav className="flex gap-2 mt-8 border-b border-white/10 overflow-x-auto">
        {TABS.map(t => (
          t.id === 'partidos' ? (
            <Link
              key={t.id}
              to={`/club/${slug}/partidos`}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${
                tab === 'partidos'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </Link>
          ) : (
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
              {t.id === 'tienda' && products.length > 0 && ` (${products.length})`}
              {t.id === 'socios' && plans.length > 0 && ` (${plans.length})`}
            </button>
          )
        ))}
      </nav>

      <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mt-4" />
      {token && !canShop && (
        <p className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          Esta cuenta es de personal del club. Para comprar o asociarte, ingresa con una cuenta de hincha.
        </p>
      )}

      {tab === 'partidos' && (
        <div className="mt-6 card p-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">Calendario del club</h2>
            <p className="text-sm text-gray-400 mt-1">
              {canShop ? 'Consulta todos los partidos y compra tus entradas.' : 'Consulta todos los partidos del club.'}
            </p>
          </div>
          <Link to={`/club/${slug}/partidos`} className="btn btn-primary py-2.5 px-5">
            Ver partidos
          </Link>
        </div>
      )}

      {tab === 'tienda' && (
        <div className="mt-6">
          {canShop && (
            <div className="flex justify-end mb-5">
              <Link
                to="/carrito"
                className="btn btn-outline flex items-center gap-2 py-2.5 px-5 relative"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>Carrito</span>
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                    {totalCartItems}
                  </span>
                )}
              </Link>
            </div>
          )}
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
                  discount={discountsByProduct[p.id]}
                  token={token}
                  canShop={canShop}
                  onAddToCart={addProductToCart}
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
                  {canShop && (
                    <button
                      type="button"
                      disabled={busy === `plan-${plan.id}`}
                      onClick={() => subscribe(plan)}
                      className="btn btn-primary mt-5 w-full py-2.5"
                    >
                      {busy === `plan-${plan.id}` ? 'Procesando...' : token ? 'Asociarme' : 'Inicia sesión'}
                    </button>
                  )}
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

function ProductCard({ product, discount, token, canShop, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    const addError = onAddToCart(product, qtyNum);
    setAdded(Boolean(token && !addError));
  };

  const handleQtyChange = value => {
    setAdded(false);
    if (value === '') {
      setQty('');
      return;
    }
    const parsedQty = Number.parseInt(value, 10);
    if (Number.isNaN(parsedQty) || parsedQty < 1) {
      setQty(1);
    } else {
      setQty(Math.min(parsedQty, product.stock));
    }
  };
  const qtyNum = Number.parseInt(qty, 10) || 1;
  let buttonLabel = 'Agregar';
  if (product.stock < 1) buttonLabel = 'Agotado';
  else if (!token) buttonLabel = 'Ingresar';
  else if (added) buttonLabel = 'Agregado ✓';

  return (
    <div className="card card-hover p-6 flex flex-col">
      <div className="mb-4">
        <ProductImage src={product.image_url} alt={product.name} />
      </div>
      <h3 className="text-xl font-bold">{product.name}</h3>
      <p className="text-sm text-gray-400 mt-1 flex-1">{product.description}</p>
      <div className="mt-3">
        {discount && <p className="text-xs text-gray-500 line-through">Bs {Number(product.price).toLocaleString('es-BO')}</p>}
        <p className="text-emerald-400 font-bold text-2xl">
          Bs {Number(discount?.finalPrice ?? product.price).toLocaleString('es-BO')}
        </p>
        {discount && <p className="text-xs text-lime-300 mt-1">Oferta: {discount.campaignTitle}</p>}
      </div>
      <p className="text-xs text-gray-500 mt-1">Stock: {product.stock}</p>

      {canShop && (
        <>
          <div className="flex items-center justify-between mt-4 gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor={`quantity-${product.id}`} className="text-xs text-gray-400 font-semibold">
                Cant.:
              </label>
              <input
                id={`quantity-${product.id}`}
                type="number"
                min="1"
                max={product.stock}
                value={qty}
                onChange={event => handleQtyChange(event.target.value)}
                disabled={product.stock < 1}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-semibold outline-none focus:border-emerald-500 text-center"
              />
            </div>
            <button
              type="button"
              disabled={product.stock < 1}
              onClick={handleAddToCart}
              className="btn btn-primary py-2 px-5 text-sm"
            >
              {buttonLabel}
            </button>
          </div>
          {added && (
            <p role="status" className="mt-3 text-sm text-emerald-300">
              Agregado al carrito. <Link to="/carrito" className="underline font-semibold">Ver carrito</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}

import AlertBanner from '../components/AlertBanner';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { productService } from '../api/product.service';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import ProductImage from '../components/ProductImage';
import CampaignBanners from '../components/CampaignBanners';
import { useCampaigns } from '../hooks/useCampaigns';

export default function Tienda() {
  const { token, user } = useAuth();
  const canShop = !token || user?.role === 'fan';
  const { cart, addToCart: addCartProduct } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { campaigns, discountsByProduct, loading: campaignsLoading, error: campaignsError } = useCampaigns({ placement: 'store' });

  useEffect(() => {
    productService.getAll()
      .then(res => { if (res.success) setProducts(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product, qty) => {
    setError(null);
    const addError = addCartProduct(product, qty);
    setError(addError);
    return addError;
  };

  const totalCartItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando tienda...</p>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="eyebrow">Merchandising oficial</span>
          <h2 className="section-title text-3xl mt-1">Tienda del Club</h2>
          <p className="text-gray-400 text-sm">
            {canShop
              ? 'Selecciona tus productos, ingresa la cantidad deseada y arma tu carrito.'
              : 'Explora los productos oficiales disponibles en la tienda del club.'}
          </p>
        </div>

        {canShop && (
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
        )}
      </div>

      {token && !canShop && (
        <p className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          Esta cuenta es de personal del club. Para comprar, ingresa con una cuenta de hincha.
        </p>
      )}

      <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mb-6" />
      <CampaignBanners campaigns={campaigns} placement="store" loading={campaignsLoading} error={campaignsError} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {products.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            discount={discountsByProduct[p.id]}
            token={token}
            canShop={canShop}
            onAddToCart={addToCart}
          />
        ))}
      </div>

      {!token && (
        <p className="mt-8 p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para armar tu carrito y comprar productos.
        </p>
      )}
    </div>
  );
}

function ProductCard({ product, discount, token, canShop, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    setAdded(!onAddToCart(product, qtyNum));
  };

  const handleQtyChange = (val) => {
    setAdded(false);
    if (val === '') {
      setQty('');
      return;
    }
    const n = Number.parseInt(val, 10);
    if (Number.isNaN(n) || n < 1) {
      setQty(1);
    } else if (n > product.stock) {
      setQty(product.stock);
    } else {
      setQty(n);
    }
  };

  const qtyNum = Number.parseInt(qty, 10) || 1;

  return (
    <div className="card card-hover p-6 flex flex-col">
      <div className="mb-4">
        <ProductImage src={product.image_url} alt={product.name} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 font-medium">{product.tenants?.name}</span>
        {product.category && (
          <span className="text-[0.65rem] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
            {product.category}
          </span>
        )}
      </div>
      <h3 className="text-xl font-bold mt-1.5 text-white">{product.name}</h3>
      <p className="text-sm text-slate-400 mt-1 flex-1 font-medium">{product.description}</p>
      <div className="flex items-baseline justify-between mt-4">
        <div>
          {discount && <p className="text-xs text-gray-500 line-through">Bs {Number(product.price).toLocaleString('es-BO')}</p>}
          <p className="text-emerald-400 font-display font-extrabold text-2xl">
            Bs {Number(discount?.finalPrice ?? product.price).toLocaleString('es-BO')}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${product.stock > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-red-950/80 text-red-300 border border-red-800'}`}>
          Stock: {product.stock}
        </span>
      </div>
      {discount && <p className="text-xs text-lime-300 mt-1">Oferta: {discount.campaignTitle}</p>}

      {canShop && (
        <>
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-800/80 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Cant:</span>
              <input
                type="number"
                min="1"
                max={product.stock}
                value={qty}
                onChange={e => handleQtyChange(e.target.value)}
                disabled={product.stock < 1}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-semibold outline-none focus:border-emerald-500 text-center"
              />
            </div>
            <button
              type="button"
              disabled={!token || product.stock < 1}
              onClick={handleAddToCart}
              className="btn btn-primary py-2 px-5 text-sm font-bold disabled:opacity-50"
            >
              {product.stock < 1 ? 'Agotado' : added ? 'Agregado ✓' : 'Agregar'}
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

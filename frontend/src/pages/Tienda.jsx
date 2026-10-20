import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productService } from '../api/product.service';
import { orderService } from '../api/order.service';
import { useAuth } from '../context/auth-context';

export default function Tienda() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    productService.getAll()
      .then(res => { if (res.success) setProducts(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (product, qty) => {
    if (!token) return;
    setBuying(product.id);
    setError(null);
    try {
      const res = await orderService.create({ product_id: product.id, quantity: qty });
      if (res.success) navigate('/mis-pedidos', { state: { message: res.message } });
    } catch (err) {
      setError(err.message);
      setBuying(null);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando tienda...</p>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <span className="eyebrow">Merchandising oficial</span>
      <h2 className="section-title text-3xl mt-1 mb-2">Tienda del Club</h2>
      <p className="text-gray-400 text-sm mb-6">Camisetas, bufandas y merchandising oficial (pago simulado).</p>

      {error && <p className="mb-4 alert-error">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {products.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            token={token}
            buying={buying === p.id}
            onBuy={handleBuy}
          />
        ))}
      </div>

      {!token && (
        <p className="mt-8 p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para comprar productos.
        </p>
      )}
    </div>
  );
}

function ProductCard({ product, token, buying, onBuy }) {
  const [qty, setQty] = useState(1);
  const max = Math.min(product.stock, 5);

  return (
    <div className="card card-hover p-6 flex flex-col">
      <div className="h-36 bg-black/40 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
        {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" /> : <span className="text-gray-600 text-sm">Sin imagen</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{product.tenants?.name}</span>
        {product.category && (
          <span className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-900/60 text-sky-300 border border-sky-800">{product.category}</span>
        )}
      </div>
      <h3 className="text-xl font-bold mt-1">{product.name}</h3>
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
          disabled={!token || buying || product.stock < 1}
          onClick={() => onBuy(product, qty)}
          className="btn btn-primary py-2 px-5 text-sm"
        >
          {buying ? '...' : product.stock < 1 ? 'Agotado' : 'Comprar'}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { productService } from '../api/product.service';
import { orderService } from '../api/order.service';
import { useAuth } from '../context/auth-context';

export default function Tienda() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    productService.getAll()
      .then(res => { if (res.success) setProducts(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (product, qty) => {
    setError(null);
    const parsedQty = Number.parseInt(qty, 10) || 1;
    const existing = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existing ? existing.quantity : 0;
    const requestedTotal = currentQtyInCart + parsedQty;

    if (requestedTotal > product.stock) {
      setError(`Stock insuficiente para "${product.name}". Stock disponible: ${product.stock}, ya tienes ${currentQtyInCart} en el carrito.`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: requestedTotal } : item));
    } else {
      setCart([...cart, { product, quantity: parsedQty }]);
    }
    setShowCart(true);
  };

  const updateCartQty = (productId, delta) => {
    setError(null);
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }
    if (newQty > item.product.stock) {
      setError(`Stock máximo alcanzado para "${item.product.name}" (${item.product.stock} disponibles).`);
      return;
    }
    setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: newQty } : i));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(i => i.product.id !== productId));
  };

  const totalCartItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalCartPrice = cart.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);

  const handleCheckout = async () => {
    if (!token || cart.length === 0) return;
    setCheckingOut(true);
    setError(null);
    try {
      for (const item of cart) {
        await orderService.create({ product_id: item.product.id, quantity: item.quantity });
      }
      setCart([]);
      navigate('/mis-pedidos', { state: { message: '¡Compra del carrito realizada exitosamente!' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando tienda...</p>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="eyebrow">Merchandising oficial</span>
          <h2 className="section-title text-3xl mt-1">Tienda del Club</h2>
          <p className="text-gray-400 text-sm">Selecciona tus productos, ingresa la cantidad deseada y arma tu carrito.</p>
        </div>

        {token && (
          <button
            type="button"
            onClick={() => setShowCart(!showCart)}
            className="btn btn-outline flex items-center gap-2 py-2.5 px-5 relative"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Carrito</span>
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                {totalCartItems}
              </span>
            )}
          </button>
        )}
      </div>

      {error && <p className="mb-6 alert-error">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              token={token}
              onAddToCart={addToCart}
            />
          ))}
        </div>

        {token && (
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  Tu Carrito
                </h3>
                <span className="text-xs text-slate-400">{totalCartItems} artículo(s)</span>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
                  El carrito está vacío. Agrega productos de la tienda.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.product.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate text-white">{item.product.name}</p>
                          <p className="text-xs text-emerald-400 font-semibold">Bs {item.product.price} c/u</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="w-7 h-7 bg-slate-900 border border-slate-700 rounded-md flex items-center justify-center hover:bg-slate-800"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="w-7 h-7 bg-slate-900 border border-slate-700 rounded-md flex items-center justify-center hover:bg-slate-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-400 hover:text-red-300 ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-semibold text-slate-300">Total a pagar</span>
                      <span className="font-display font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-300">
                        Bs {totalCartPrice.toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={checkingOut || cart.length === 0}
                      onClick={handleCheckout}
                      className="btn btn-primary w-full py-3 font-bold"
                    >
                      {checkingOut ? 'Procesando pago...' : 'Completar Compra (Pago Simulado)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!token && (
        <p className="mt-8 p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para armar tu carrito y comprar productos.
        </p>
      )}
    </div>
  );
}

function ProductCard({ product, token, onAddToCart }) {
  const [qty, setQty] = useState(1);

  const handleQtyChange = (val) => {
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
      <div className="h-40 bg-black/40 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <span className="text-slate-500 text-sm">Sin imagen</span>
        )}
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
        <p className="text-emerald-400 font-display font-extrabold text-2xl">Bs {product.price}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${product.stock > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-red-950/80 text-red-300 border border-red-800'}`}>
          Stock: {product.stock}
        </span>
      </div>

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
          onClick={() => onAddToCart(product, qtyNum)}
          className="btn btn-primary py-2 px-5 text-sm font-bold disabled:opacity-50"
        >
          {product.stock < 1 ? 'Agotado' : 'Agregar'}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { orderService } from '../api/order.service';

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

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const [msg, setMsg] = useState(location.state?.message);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    orderService.getMyOrders()
      .then(res => {
        if (res.success) setOrders(res.data);
        else setError(res.message || 'No se pudieron cargar los pedidos.');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Mis Pedidos</h2>

      {msg && <p className="mb-6 p-3 rounded text-center bg-emerald-900 text-emerald-300">{msg}</p>}
      {loading && <p className="text-center text-gray-400 py-8">Cargando pedidos...</p>}
      {error && <p className="p-3 rounded text-center bg-red-900 text-red-300">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
          <p className="text-gray-400 mb-4">Todavía no tienes pedidos.</p>
          <Link to="/tienda" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg transition">
            Ir a la Tienda
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {orders.map(o => (
          <div key={o.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg">{o.products?.name}</h3>
              <p className="text-xs text-gray-400">{o.tenants?.name}</p>
              <p className="text-sm text-gray-300 mt-1">
                {o.quantity} × Bs {o.unit_price} = <span className="font-semibold text-emerald-400">Bs {o.total}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">{new Date(o.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${STATUS_STYLES[o.status] || 'bg-gray-700 text-gray-300'}`}>
              {STATUS_LABELS[o.status] || o.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

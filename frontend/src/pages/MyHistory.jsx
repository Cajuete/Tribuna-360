import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketService } from '../api/ticket.service';
import { orderService } from '../api/order.service';
import { membershipService } from '../api/membership.service';

export default function MyHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      ticketService.getMyTickets(),
      orderService.getMyOrders(),
      membershipService.getMine(),
    ])
      .then(([t, o, m]) => {
        const list = [];
        if (t?.success) t.data.forEach(x => list.push({ type: 'ticket', date: x.created_at, data: x }));
        if (o?.success) o.data.forEach(x => list.push({ type: 'order', date: x.created_at, data: x }));
        if (m?.status === 'success') m.data.forEach(x => list.push({ type: 'membership', date: x.created_at, data: x }));
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        setItems(list);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando historial...</p>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Mi Historial</h2>
      {error && <p className="mb-4 alert-error">{error}</p>}

      {items.length === 0 && (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
          <p className="text-gray-400 mb-4">Todavía no tienes actividad registrada.</p>
          <Link to="/" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg transition">
            Explorar partidos
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {items.map((it, idx) => {
          if (it.type === 'ticket') {
            const t = it.data;
            return (
              <div key={`t-${t.id}`} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-900 text-emerald-300">Entrada</span>
                  <span className="text-xs text-gray-500">{new Date(it.date).toLocaleString()}</span>
                </div>
                <h3 className="font-bold text-lg mt-2">{t.matches?.opponent || 'Partido'}</h3>
                <p className="text-sm text-gray-400">{t.zones?.name || 'Zona'} · Bs {t.price}</p>
              </div>
            );
          }
          if (it.type === 'order') {
            const o = it.data;
            return (
              <div key={`o-${o.id}`} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-sky-900 text-sky-300">Pedido</span>
                  <span className="text-xs text-gray-500">{new Date(it.date).toLocaleString()}</span>
                </div>
                <h3 className="font-bold text-lg mt-2">{o.products?.name || 'Producto'}</h3>
                <p className="text-sm text-gray-400">{o.quantity} × Bs {o.unit_price} = Bs {o.total}</p>
              </div>
            );
          }
          const m = it.data;
          return (
            <div key={`m-${m.id}`} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-1 rounded-full bg-purple-900 text-purple-300">Membresía</span>
                <span className="text-xs text-gray-500">{new Date(it.date).toLocaleString()}</span>
              </div>
              <h3 className="font-bold text-lg mt-2">{m.membership_plans?.name || 'Plan'}</h3>
              <p className="text-sm text-gray-400">{m.tenants?.name || 'Club'} · {m.status === 'active' ? 'Activa' : 'Cancelada'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
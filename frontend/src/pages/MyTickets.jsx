import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { ticketService } from '../api/ticket.service';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [qrs, setQrs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const message = location.state?.message;

  useEffect(() => {
    ticketService.getMyTickets()
      .then(res => {
        if (res.success) {
          setTickets(res.data);
          return Promise.all(
            res.data.map(t =>
              QRCode.toDataURL(t.qr_code, { width: 240, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
                .then(url => [t.id, url])
            )
          );
        }
        return [];
      })
      .then(pairs => {
        if (pairs.length) setQrs(Object.fromEntries(pairs));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Mis Entradas</h2>

      {message && (
        <p className="mb-6 p-3 rounded text-center bg-emerald-900 text-emerald-300">{message}</p>
      )}

      {loading && <p className="text-center text-gray-400 py-8">Cargando tus entradas...</p>}
      {error && <p className="p-3 rounded text-center bg-red-900 text-red-300">{error}</p>}

      {!loading && !error && tickets.length === 0 && (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
          <p className="text-gray-400 mb-4">Todavía no tienes entradas.</p>
          <Link to="/" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg transition">
            Ver partidos
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tickets.map(t => (
          <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl flex gap-5">
            <div className="flex-1">
              <span className={`text-xs px-2 py-1 rounded-full uppercase font-semibold ${
                t.status === 'valid' ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'
              }`}>
                {t.status === 'valid' ? 'Válida' : 'Usada'}
              </span>
              <h3 className="text-xl font-bold mt-2">{t.matches?.opponent}</h3>
              <p className="text-sm text-gray-400 mt-1">{t.matches?.stadium_name}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(t.matches?.match_date).toLocaleString()}</p>
              <p className="text-sm mt-3">
                <span className="text-gray-400">Zona:</span> <span className="font-semibold">{t.zones?.name || '—'}</span>
                {' · '}
                <span className="text-emerald-400 font-semibold">Bs {t.price}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1 break-all">Código: {t.qr_code}</p>
            </div>
            <div className="w-32 h-32 shrink-0 bg-white rounded-xl p-1.5 flex items-center justify-center">
              {qrs[t.id] ? (
                <img src={qrs[t.id]} alt={`QR ${t.qr_code}`} className="w-full h-full" />
              ) : (
                <span className="text-gray-400 text-xs text-center">Generando QR...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

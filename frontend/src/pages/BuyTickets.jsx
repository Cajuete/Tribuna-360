import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { matchService } from '../api/match.service';
import { ticketService } from '../api/ticket.service';
import { useAuth } from '../context/auth-context';

export default function BuyTickets() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [match, setMatch] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      matchService.getMatchById(matchId),
      matchService.getZones(matchId),
    ])
      .then(([m, z]) => {
        if (m.status === 'success') setMatch(m.data);
        if (z.status === 'success') setZones(z.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  const total = selectedZone ? selectedZone.price * quantity : 0;

  const handlePurchase = async () => {
    if (!token) return;
    if (!selectedZone) {
      setError('Selecciona una zona primero.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await ticketService.purchase({
        match_id: matchId,
        zone_id: selectedZone.id,
        quantity,
      });
      if (res.success) navigate('/mis-entradas', { state: { message: res.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando partido...</p>;

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400">{error || 'Partido no encontrado.'}</p>
        <Link to="/" className="text-emerald-400 underline mt-4 inline-block">Volver a la cartelera</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">&larr; Volver a la cartelera</Link>

      <div className="card p-6 mt-4">
        <span className="badge">{match.status}</span>
        <h2 className="section-title text-3xl mt-3">{match.opponent}</h2>
        <p className="text-sm text-gray-400 mt-1">{match.stadium_name} &middot; {new Date(match.match_date).toLocaleString()}</p>
        <p className="text-sm text-gray-500 mt-1">Club: {match.tenants?.name}</p>
      </div>

      <span className="eyebrow mt-8 block">Zonas del estadio</span>
      <h3 className="section-title text-2xl mt-1 mb-3">Elige tu zona</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {zones.map(z => (
          <button
            key={z.id}
            type="button"
            onClick={() => setSelectedZone(z)}
            className={`text-left p-4 rounded-xl border transition ${
              selectedZone?.id === z.id
                ? 'bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-500 shadow-[0_14px_34px_-16px_rgba(16,185,129,.8)]'
                : 'card card-hover border-white/10'
            }`}
          >
            <p className="font-bold text-lg text-white">{z.name}</p>
            <p className="text-emerald-400 font-semibold">Bs {z.price}</p>
            <p className="text-xs text-gray-400 mt-1">Aforo: {z.capacity}</p>
          </button>
        ))}
      </div>

      {selectedZone && (
        <div className="card p-6 mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-300">Cantidad:</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuantity(n)}
                  className={`w-10 h-10 rounded-lg font-bold transition ${
                    quantity === n ? 'bg-gradient-to-r from-emerald-600 to-lime-600 text-white shadow-lg' : 'bg-white/5 text-gray-300 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total</p>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-300">Bs {total}</p>
          </div>
        </div>
      )}

      {!token && (
        <p className="mt-6 p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para comprar tus entradas.
        </p>
      )}

      {token && (
        <button
          type="button"
          onClick={handlePurchase}
          disabled={!selectedZone || sending}
          className="btn btn-primary mt-6 w-full"
        >
          {sending ? 'Procesando pago...' : selectedZone ? `Pagar (pago simulado) - Bs ${total}` : 'Selecciona una zona'}
        </button>
      )}

      {error && <p className="mt-4 alert-error">{error}</p>}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Ticket, ShieldAlert } from 'lucide-react';
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

  const maxAllowed = selectedZone ? Math.min(selectedZone.available ?? selectedZone.capacity ?? 10, 10) : 1;

  const handleQtyChange = (val) => {
    if (val === '') {
      setQuantity('');
      return;
    }
    const num = Number.parseInt(val, 10);
    if (Number.isNaN(num) || num < 1) {
      setQuantity(1);
    } else if (num > maxAllowed) {
      setQuantity(maxAllowed);
      setError(`El límite máximo por compra para esta zona es de ${maxAllowed} entradas.`);
    } else {
      setQuantity(num);
      setError(null);
    }
  };

  const qtyNum = Number.parseInt(quantity, 10) || 1;
  const total = selectedZone ? selectedZone.price * qtyNum : 0;

  const handlePurchase = async () => {
    if (!token) return;
    if (!selectedZone) {
      setError('Selecciona una zona del estadio primero.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await ticketService.purchase({
        match_id: matchId,
        zone_id: selectedZone.id,
        quantity: qtyNum,
      });
      if (res.success) navigate('/mis-entradas', { state: { message: res.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando cartelera del partido...</p>;

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400">{error || 'Partido no encontrado.'}</p>
        <Link to="/" className="text-emerald-400 underline mt-4 inline-block font-semibold">Volver a la cartelera</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold">&larr; Volver a partidos</Link>

      <div className="card p-6 md:p-8 mt-5 border border-slate-700">
        {match.image_url && (
          <div className="mb-5 rounded-xl overflow-hidden h-48">
            <img src={match.image_url} alt={`vs ${match.opponent}`} className="w-full h-full object-cover" />
          </div>
        )}
        <span className="badge uppercase">{match.status}</span>
        <h2 className="section-title text-3xl md:text-4xl mt-3 text-white">Vs. {match.opponent}</h2>
        <p className="text-sm text-slate-300 mt-2 font-medium">{match.stadium_name} &middot; {new Date(match.match_date).toLocaleString()}</p>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">Club Organizador: {match.tenants?.name}</p>
      </div>

      <div className="mt-10">
        <span className="eyebrow">Tribunas y Aforo</span>
        <h3 className="section-title text-2xl mt-1 mb-4">Selecciona tu Zona (Curvas / Tribunas)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {zones.map(z => (
            <button
              key={z.id}
              type="button"
              onClick={() => { setSelectedZone(z); setQuantity(1); setError(null); }}
              className={`text-left p-5 rounded-2xl border transition relative overflow-hidden ${
                selectedZone?.id === z.id
                  ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xl'
                  : 'card card-hover border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-lg text-white font-display">{z.name}</p>
                <Ticket className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-display font-extrabold text-2xl mt-2">Bs {z.price}</p>
              <p className="text-xs text-slate-400 mt-2 font-medium">Entradas disponibles: <span className="text-white font-bold">{z.available ?? z.capacity}</span></p>
            </button>
          ))}
        </div>
      </div>

      {selectedZone && (
        <div className="card p-6 md:p-8 mt-8 border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              ¿Cuántas entradas deseas comprar? (Máx. {maxAllowed})
            </label>
            <input
              type="number"
              min="1"
              max={maxAllowed}
              value={quantity}
              onChange={e => handleQtyChange(e.target.value)}
              className="w-48 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold text-lg outline-none focus:border-emerald-500"
              placeholder="Ej. 2"
            />
          </div>

          <div className="text-right md:text-right w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-800">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Total a Pagar</p>
            <p className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-300 mt-1">
              Bs {total.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {!token && (
        <div className="mt-8 p-5 rounded-2xl glass border border-slate-800 text-center text-slate-300">
          <Link to="/login" className="text-emerald-400 font-bold underline">Inicia sesión</Link> para asegurar tus entradas.
        </div>
      )}

      {token && (
        <button
          type="button"
          onClick={handlePurchase}
          disabled={!selectedZone || sending}
          className="btn btn-primary mt-8 w-full py-4 text-base font-bold uppercase tracking-wider shadow-lg disabled:opacity-50"
        >
          {sending ? 'Procesando compra segura...' : selectedZone ? `Confirmar Compra (Pago Simulado) — Bs ${total}` : 'Selecciona una zona del estadio'}
        </button>
      )}

      {error && (
        <div className="mt-5 p-4 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-sm font-semibold flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

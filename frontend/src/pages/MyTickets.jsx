import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { Printer, Ticket, ShieldCheck, Calendar, MapPin } from 'lucide-react';
import { ticketService } from '../api/ticket.service';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [qrs, setQrs] = useState({});
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
    ticketService.getMyTickets()
      .then(res => {
        if (res.success) {
          setTickets(res.data);
          return Promise.all(
            res.data.map(t =>
              QRCode.toDataURL(t.qr_code, { width: 280, margin: 2, color: { dark: '#070b10', light: '#ffffff' } })
                .then(url => [t.id, url])
            )
          );
        }
        setError(res.message || 'No se pudieron cargar las entradas.');
        return [];
      })
      .then(pairs => {
        if (pairs.length) setQrs(Object.fromEntries(pairs));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <span className="eyebrow">Billetera Digital</span>
          <h2 className="section-title text-3xl mt-1 text-white">Mis Entradas Oficiales</h2>
          <p className="text-slate-400 text-sm">Presenta tu código QR en el acceso del estadio o imprime tu boleto oficial.</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-primary py-2.5 px-5 text-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir Todos los Tickets
        </button>
      </div>

      {msg && (
        <p className="mb-6 p-4 rounded-xl text-center bg-emerald-950 border border-emerald-500 text-emerald-200 font-semibold print:hidden">{msg}</p>
      )}

      {loading && <p className="text-center text-slate-400 py-12 print:hidden">Cargando tus entradas digitales...</p>}
      {error && <p className="p-4 rounded-xl text-center bg-red-950 border border-red-500 text-red-200 print:hidden">{error}</p>}

      {!loading && !error && tickets.length === 0 && (
        <div className="text-center py-16 card border border-slate-800 rounded-3xl print:hidden">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-5 font-medium">Todavía no cuentas con entradas adquiridas en la plataforma.</p>
          <Link to="/" className="btn btn-primary py-2.5 px-6">
            Explorar Cartelera de Partidos
          </Link>
        </div>
      )}

      <div className="space-y-8 print:space-y-6">
        {tickets.map(t => (
          <div
            key={t.id}
            className="printable-ticket card border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row bg-gradient-to-br from-slate-900 via-slate-950 to-black print:bg-white print:text-black print:border-2 print:border-black"
          >
            {/* Header / Main Info */}
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="firma text-xl font-bold">Tribuna 360</span>
                    <span className="text-xs text-slate-500 font-mono">| PASS OFICIAL</span>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full uppercase font-extrabold tracking-wider ${
                    t.status === 'valid'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 print:bg-slate-100 print:text-black'
                      : 'bg-red-950 text-red-300 border border-red-700'
                  }`}>
                    {t.status === 'valid' ? '✓ Entrada Válida' : '✕ Entrada Usada'}
                  </span>
                </div>

                <h3 className="font-display text-2xl md:text-3xl font-extrabold text-white print:text-black">
                  Vs. {t.matches?.opponent}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm font-medium text-slate-300 print:text-gray-800">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t.matches?.stadium_name || 'Estadio Oficial'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{new Date(t.matches?.match_date).toLocaleString('es-BO')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800/80 print:border-gray-300 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-slate-400 print:text-gray-600 font-bold">Tribuna / Zona</p>
                  <p className="font-display font-bold text-lg text-white print:text-black">{t.zones?.name || 'General'}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-slate-400 print:text-gray-600 font-bold">Precio Abonado</p>
                  <p className="font-display font-bold text-lg text-emerald-400 print:text-black">Bs {t.price}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-slate-400 print:text-gray-600 font-bold">Firma Segura</p>
                  <p className="font-mono text-xs text-slate-400 print:text-gray-600">{t.qr_code.slice(0, 16)}...</p>
                </div>
              </div>
            </div>

            {/* Perforated Divider (Desktop) */}
            <div className="hidden md:flex flex-col items-center justify-center bg-slate-950/60 border-l border-r border-dashed border-slate-700/80 px-2 print:border-gray-400">
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 -ml-4 mb-2 print:bg-white print:border-gray-400" />
              <div className="h-28 w-px border-l border-dashed border-slate-700" />
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 -ml-4 mt-2 print:bg-white print:border-gray-400" />
            </div>

            {/* QR Section */}
            <div className="bg-slate-950/80 p-6 md:p-8 flex flex-col items-center justify-center text-center border-t md:border-t-0 border-slate-800 print:bg-white">
              <div className="w-36 h-36 bg-white rounded-2xl p-2 flex items-center justify-center shadow-xl border border-slate-700 print:border-black">
                {qrs[t.id] ? (
                  <img src={qrs[t.id]} alt={`QR ${t.qr_code}`} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-slate-500 text-xs font-semibold">Generando...</span>
                )}
              </div>
              <p className="text-[0.65rem] font-mono text-slate-400 print:text-gray-700 mt-3 tracking-wider">{t.qr_code}</p>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 border border-emerald-700/80 px-4 py-2 rounded-xl transition print:hidden shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir este Boleto
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

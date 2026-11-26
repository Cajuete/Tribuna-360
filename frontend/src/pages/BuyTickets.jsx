import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Ticket, ShieldAlert } from 'lucide-react';
import { matchService } from '../api/match.service';
import { ticketService } from '../api/ticket.service';
import { paymentService } from '../api/payment.service';
import { campaignService } from '../api/campaign.service';
import { promotionService } from '../api/promotion.service';
import { useAuth } from '../context/auth-context';
import { getPromotionDiscount } from '../utils/promotion-code';

export default function BuyTickets() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const requiresQueue = Boolean(token && user?.role !== 'box_office_cashier');

  const [match, setMatch] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticketCampaigns, setTicketCampaigns] = useState([]);
  const [promotionError, setPromotionError] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState(null);
  const [validatingPromotion, setValidatingPromotion] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(timer);
  }, [error]);
  const [queueState, setQueueState] = useState(null);
  const [queueChecking, setQueueChecking] = useState(false);
  const [queueAction, setQueueAction] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMatch(null);
    setZones([]);
    setSelectedZoneId(null);
    setQuantity(1);
    setPromotionCode('');
    setAppliedPromotion(null);
    setPromotionMessage(null);
    setError(null);

    Promise.all([
      matchService.getMatchById(matchId),
      matchService.getZones(matchId),
    ])
      .then(([m, z]) => {
        if (cancelled) return;
        if (m.status === 'success') setMatch(m.data);
        if (z.status === 'success') setZones(z.data);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [matchId]);

  useEffect(() => {
    let active = true;
    if (!match?.tenant_id) return () => { active = false; };

    campaignService.getPublic({ tenant_id: match.tenant_id })
      .then(response => {
        if (!active) return;
        if (!response.success) throw new Error(response.message || 'No se pudieron consultar las promociones.');
        setTicketCampaigns(response.data || []);
        setPromotionError(null);
      })
      .catch(loadError => {
        if (active) {
          console.error('[TicketCampaigns] No se pudieron consultar las promociones:', loadError);
          setTicketCampaigns([]);
          setPromotionError(loadError.message);
        }
      });

    return () => { active = false; };
  }, [match?.tenant_id]);

  useEffect(() => {
    let cancelled = false;
    if (!requiresQueue) {
      setQueueState(null);
      setQueueChecking(false);
      return () => { cancelled = true; };
    }

    setQueueState(null);
    setQueueChecking(true);
    ticketService.getQueueStatus(matchId)
      .then(res => {
        if (!cancelled) setQueueState(res.data);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setQueueChecking(false);
      });

    return () => { cancelled = true; };
  }, [matchId, requiresQueue, token]);

  useEffect(() => {
    if (!requiresQueue || queueState?.status !== 'waiting') return undefined;

    const interval = setInterval(() => {
      ticketService.getQueueStatus(matchId)
        .then(res => setQueueState(res.data))
        .catch(err => setError(err.message));
    }, 3000);

    return () => clearInterval(interval);
  }, [matchId, queueState?.status, requiresQueue]);

  const handleJoinQueue = async () => {
    setError(null);
    setQueueAction(true);
    try {
      const res = await ticketService.joinQueue(matchId);
      setQueueState(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueAction(false);
    }
  };

  const handleLeaveQueue = async () => {
    setError(null);
    setQueueAction(true);
    try {
      const res = await ticketService.leaveQueue(matchId);
      setQueueState(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueAction(false);
    }
  };

  const selectedZone = zones.find(zone => zone.id === selectedZoneId) || null;
  const maxAllowed = selectedZone
    ? Math.max(0, Math.floor(Number(selectedZone.available ?? selectedZone.capacity ?? 0)))
    : 0;
  const getTicketDiscount = zone => {
    let bestDiscount = null;
    for (const campaign of ticketCampaigns) {
      for (const offer of campaign.campaign_ticket_offers || []) {
        if (offer.match_id !== match?.id || offer.zone_id !== zone.id) continue;
        const basePrice = Number(zone.price);
        const requestedDiscount = offer.discount_type === 'percentage'
          ? basePrice * Number(offer.discount_value) / 100
          : Number(offer.discount_value);
        const discount = Math.round(Math.min(basePrice, requestedDiscount) * 100) / 100;
        const isBetterTie = bestDiscount && discount === bestDiscount.discount &&
          new Date(campaign.created_at) < new Date(bestDiscount.createdAt);
        if (discount > 0 && (!bestDiscount || discount > bestDiscount.discount || isBetterTie)) {
          bestDiscount = {
            campaignTitle: campaign.title,
            createdAt: campaign.created_at,
            discount,
            finalPrice: Math.max(0, Math.round((basePrice - discount) * 100) / 100),
          };
        }
      }
    }
    return bestDiscount;
  };

  const handleQtyChange = (val) => {
    setAppliedPromotion(null);
    setPromotionMessage(null);
    if (val === '') {
      setQuantity('');
      return;
    }
    const num = Number.parseInt(val, 10);
    if (Number.isNaN(num) || num < 1) {
      setQuantity(1);
    } else if (num > maxAllowed) {
      setQuantity(maxAllowed);
      setError(`En esta zona quedan ${maxAllowed} entradas disponibles.`);
    } else {
      setQuantity(num);
      setError(null);
    }
  };

  const qtyNum = Number.parseInt(quantity, 10) || 1;
  const selectedZoneDiscount = selectedZone ? getTicketDiscount(selectedZone) : null;
  const total = selectedZone
    ? Number(selectedZoneDiscount?.finalPrice ?? selectedZone.price) * qtyNum
    : 0;
  const codeDiscount = getPromotionDiscount(total, appliedPromotion);
  const totalWithCode = Math.max(0, total - codeDiscount);
  const queueBlocksPurchase = requiresQueue &&
    queueState?.status !== 'disabled' &&
    (queueState?.status !== 'admitted' || !queueState.access_token);
  const purchaseButtonLabel = (() => {
    if (!requiresQueue || queueState?.status === 'disabled') {
      return `Continuar al pago QR — Bs ${totalWithCode}`;
    }
    if (queueChecking) return 'Verificando tu turno...';
    if (!queueState) return 'No se pudo verificar el turno';
    if (queueState.status === 'waiting') return `En fila — posición ${queueState.position}`;
    if (queueState.status === 'not_joined') return 'Únete a la fila para continuar';
    if (queueState.status === 'admitted' && queueState.access_token) {
      return `Continuar al pago QR — Bs ${totalWithCode}`;
    }
    return 'Turno no disponible';
  })();

  const handleApplyPromotion = async () => {
    if (!selectedZone || !match) return;
    if (!promotionCode.trim()) {
      setPromotionMessage({ ok: false, text: 'Escribe el código que te compartieron.' });
      setAppliedPromotion(null);
      return;
    }
    setValidatingPromotion(true);
    setPromotionMessage(null);
    try {
      const response = await promotionService.validateCode({
        code: promotionCode,
        purchase_type: 'ticket',
        match_id: match.id,
        zone_id: selectedZone.id,
        quantity: qtyNum,
      });
      if (getPromotionDiscount(total, response.data) >= total) {
        setAppliedPromotion(null);
        setPromotionMessage({ ok: false, text: 'El descuento no puede dejar el pago en cero. Usa un código de menor valor.' });
        return;
      }
      setAppliedPromotion(response.data);
      setPromotionCode(response.data.code);
      setPromotionMessage({ ok: true, text: 'Código válido. El descuento se aplicará a esta compra.' });
    } catch (validationError) {
      setAppliedPromotion(null);
      setPromotionMessage({ ok: false, text: validationError.message });
    } finally {
      setValidatingPromotion(false);
    }
  };

  const handlePurchase = async () => {
    if (!token) return;
    if (appliedPromotion && totalWithCode <= 0) {
      setError('El descuento no puede dejar el pago en cero. Usa un código de menor valor.');
      return;
    }
    if (
      requiresQueue &&
      queueState?.status !== 'disabled' &&
      (queueState?.status !== 'admitted' || !queueState.access_token)
    ) {
      setError('Primero debes unirte a la fila virtual y esperar tu turno.');
      return;
    }
    if (!selectedZone) {
      setError('Selecciona una zona del estadio primero.');
      return;
    }
    if (promotionCode.trim() && !appliedPromotion) {
      setError('Aplica primero el código promocional o bórralo para continuar.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await paymentService.create('ticket', {
        match_id: matchId,
        zone_id: selectedZone.id,
        quantity: qtyNum,
        promo_code: appliedPromotion?.code,
      }, requiresQueue ? queueState?.access_token : undefined);
      if (res.success) navigate(`/pagar/${res.data.id}`);
    } catch (err) {
      setError(err.message);
      if (requiresQueue) {
        try {
          const queue = await ticketService.getQueueStatus(matchId);
          setQueueState(queue.data);
        } catch (queueError) {
          setQueueState(null);
          setError(`${err.message} No se pudo actualizar el estado de la fila: ${queueError.message}`);
        }
      }
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

      <div className={`relative mt-5 rounded-xl border border-slate-700 ${match.image_url ? 'min-h-[360px] overflow-hidden bg-slate-950' : 'card p-6 md:p-8'}`}>
        {match.image_url && (
          <>
            <img src={match.image_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/10" />
          </>
        )}
        <div className={match.image_url ? 'relative z-10 flex min-h-[360px] flex-col justify-end p-6 md:p-8' : ''}>
          <span className="badge uppercase self-start">{match.status}</span>
          <h2 className="section-title text-3xl md:text-4xl mt-3 text-white">Vs. {match.opponent}</h2>
          <p className="text-sm text-slate-300 mt-2 font-medium">{match.stadium_name} &middot; {new Date(match.match_date).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">Club Organizador: {match.tenants?.name}</p>
        </div>
      </div>

      <div className="mt-10">
        <span className="eyebrow">Tribunas y Aforo</span>
        <h3 className="section-title text-2xl mt-1 mb-4">Selecciona tu Zona (Curvas / Tribunas)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {zones.map(z => {
            const discount = getTicketDiscount(z);
            return (
            <button
              key={z.id}
              type="button"
              disabled={z.sale_mode === 'numbered' || !z.is_enabled || z.available === 0}
              onClick={() => {
                setSelectedZoneId(z.id);
                setQuantity(1);
                setAppliedPromotion(null);
                setPromotionMessage(null);
                setError(null);
              }}
              className={`text-left p-5 rounded-2xl border transition relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-60 ${
                selectedZone?.id === z.id
                  ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xl'
                  : 'card card-hover border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-lg text-white font-display">{z.name}</p>
                <Ticket className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {z.sale_mode === 'numbered' ? 'Butacas numeradas' : 'Entrada general'}
              </p>
              {discount && <p className="text-xs text-emerald-300 mt-2">{discount.campaignTitle}</p>}
              {discount && <p className="text-sm text-slate-400 line-through">Bs {Number(z.price).toLocaleString('es-BO')}</p>}
              <p className="text-emerald-400 font-display font-extrabold text-2xl mt-2">
                Bs {Number(discount?.finalPrice ?? z.price).toLocaleString('es-BO')}
              </p>
              {z.sale_mode === 'numbered' ? (
                <p className="text-xs text-amber-300 mt-2">La selección de butacas estará disponible en una próxima etapa.</p>
              ) : (
                <p className="text-xs text-slate-400 mt-2 font-medium">Entradas disponibles: <span className="text-white font-bold">{z.available ?? z.capacity}</span></p>
              )}
            </button>
            );
          })}
        </div>
      </div>

      {promotionError && (
        <p className="mt-4 text-xs text-amber-300">
          No se pudieron consultar las promociones en este momento. El precio definitivo se confirmará antes de pagar.
        </p>
      )}

      {selectedZone && (
        <div className="card p-6 md:p-8 mt-8 border border-slate-700 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-6">
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              ¿Cuántas entradas deseas comprar? (Disponibles: {maxAllowed})
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

          <div>
            <label htmlFor="ticket-promo-code" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
              ¿Tienes un código promocional?
            </label>
            <div className="flex gap-2">
              <input
                id="ticket-promo-code"
                value={promotionCode}
                onChange={event => {
                  setPromotionCode(event.target.value.toUpperCase());
                  setAppliedPromotion(null);
                  setPromotionMessage(null);
                }}
                maxLength={50}
                placeholder="Ej. HINCHA10"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleApplyPromotion}
                disabled={!token || validatingPromotion || !selectedZone}
                className="rounded-xl border border-emerald-700 px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
              >
                {validatingPromotion ? 'Validando...' : 'Aplicar'}
              </button>
            </div>
            {promotionMessage && (
              <p className={`mt-2 text-xs ${promotionMessage.ok ? 'text-emerald-300' : 'text-rose-300'}`} role="status">
                {promotionMessage.text}
              </p>
            )}
            {!token && <p className="mt-2 text-xs text-slate-400">Inicia sesión para validar tu código.</p>}
            {appliedPromotion && (
              <p className="mt-2 text-xs text-emerald-300">
                Ahorras Bs {codeDiscount.toLocaleString('es-BO')} con {appliedPromotion.code}.
              </p>
            )}
          </div>

          <div className="text-right border-t border-slate-800 pt-4 md:border-t-0 md:pt-0">
            {appliedPromotion && (
              <p className="text-sm text-slate-400 line-through">Bs {total.toLocaleString('es-BO')}</p>
            )}
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Total a pagar</p>
            <p className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-300 mt-1">
              Bs {totalWithCode.toLocaleString('es-BO')}
            </p>
          </div>
        </div>
      )}

      {!token && (
        <div className="mt-8 p-5 rounded-2xl glass border border-slate-800 text-center text-slate-300">
          <Link to="/login" className="text-emerald-400 font-bold underline">Inicia sesión</Link> para asegurar tus entradas.
        </div>
      )}

      {requiresQueue && queueChecking && (
        <p className="mt-8 text-center text-sm text-slate-400">Verificando tu turno de compra...</p>
      )}

      {requiresQueue && !queueChecking && queueState?.status === 'not_joined' && (
        <div className="mt-8 p-5 rounded-2xl bg-slate-900 border border-slate-700 text-center">
          <p className="text-slate-200 font-semibold">Para continuar, únete a la fila virtual de este partido.</p>
          <p className="text-sm text-slate-400 mt-2">La fila ordena las compras cuando hay alta demanda y ayuda a mantener estable la venta. No reserva entradas: el aforo disponible puede agotarse mientras esperas.</p>
          <button
            type="button"
            onClick={handleJoinQueue}
            disabled={queueAction}
            className="btn btn-primary mt-4 px-6 py-3 font-bold disabled:opacity-50"
          >
            {queueAction ? 'Ingresando a la fila...' : 'Unirme a la fila virtual'}
          </button>
        </div>
      )}

      {requiresQueue && !queueChecking && queueState?.status === 'waiting' && (
        <div className="mt-8 p-5 rounded-2xl bg-amber-950/50 border border-amber-700 text-center">
          <p className="text-amber-200 font-bold">Estás en la fila virtual</p>
          <p className="text-sm text-slate-300 mt-2">La fila controla quién puede iniciar la compra; no reserva entradas ni cambia su precio.</p>
          <p className="text-slate-200 mt-1">Tu posición: {queueState.position}</p>
          <p className="text-sm text-slate-400 mt-2">La página se actualizará automáticamente cada 3 segundos.</p>
          <button
            type="button"
            onClick={handleLeaveQueue}
            disabled={queueAction || sending}
            className="mt-4 text-sm text-slate-300 underline disabled:opacity-50"
          >
            Salir de la fila
          </button>
        </div>
      )}

      {requiresQueue && !queueChecking && queueState?.status === 'admitted' && (
        <div className="mt-8 p-5 rounded-2xl bg-emerald-950/50 border border-emerald-700 text-center">
          <p className="text-emerald-300 font-bold">¡Es tu turno! Ya puedes completar la compra.</p>
          {queueState.expires_at && (
            <p className="text-sm text-slate-300 mt-2">
              Tu turno vence: {new Date(queueState.expires_at).toLocaleTimeString()}
            </p>
          )}
          {queueState.bypass && (
            <p className="text-xs text-amber-300 mt-2">Acceso temporal: Redis no está disponible.</p>
          )}
          <button
            type="button"
            onClick={handleLeaveQueue}
            disabled={queueAction || sending}
            className="mt-4 text-sm text-slate-300 underline disabled:opacity-50"
          >
            Salir de la fila
          </button>
        </div>
      )}

      {token && (
        <button
          type="button"
          onClick={handlePurchase}
          disabled={
            !selectedZone ||
            maxAllowed < 1 ||
            sending ||
            (appliedPromotion && totalWithCode <= 0) ||
            (requiresQueue && queueChecking) ||
            queueBlocksPurchase
          }
          className="btn btn-primary mt-8 w-full py-4 text-base font-bold uppercase tracking-wider shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? 'Preparando compra...' : !selectedZone ? 'Selecciona una zona del estadio' : purchaseButtonLabel}
        </button>
      )}
      {appliedPromotion && totalWithCode <= 0 && (
        <p className="mt-2 text-sm text-amber-300">El descuento no puede dejar el pago en cero. Usa un código de menor valor.</p>
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

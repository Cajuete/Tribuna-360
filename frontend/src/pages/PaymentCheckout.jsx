import AlertBanner from '../components/AlertBanner';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { paymentService } from '../api/payment.service';

const STATUS_LABELS = {
  awaiting_proof: 'Esperando comprobante',
  pending_review: 'En revisión por el club',
  approved: 'Pago confirmado',
  rejected: 'Pago rechazado',
  cancelled: 'Cancelado',
};

export default function PaymentCheckout() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [file, setFile] = useState(null);
  const [buyerNote, setBuyerNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadPayment = useCallback(() => paymentService.get(paymentId)
    .then(res => setPayment(res.data))
    .catch(err => setError(err.message))
    .finally(() => setLoading(false)), [paymentId]);

  useEffect(() => {
    loadPayment();
  }, [paymentId, loadPayment]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Adjunta una foto o PDF del comprobante.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await paymentService.submitProof(paymentId, file, buyerNote);
      setNotice(response.message);
      setFile(null);
      setBuyerNote('');
      await loadPayment();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando pago...</p>;
  if (error && !payment) {
    return <p className="max-w-2xl mx-auto px-6 py-12 text-center text-red-300">{error}</p>;
  }
  if (!payment) return null;

  const settings = payment.payment_settings;
  const delivery = payment.purchase_data?.delivery;
  const purchaseItems = payment.purchase_data?.items_summary || [];
  const ticketDiscount = payment.purchase_data?.campaign_ticket_discount;
  const membershipDiscount = payment.purchase_data?.campaign_membership_discount;
  const promoCode = payment.purchase_data?.promo_code_applied ? payment.purchase_data?.promo_code : null;
  const promoDiscount = Number(payment.purchase_data?.promo_discount_total || 0);
  const productSubtotal = purchaseItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const isAwaitingProof = payment.status === 'awaiting_proof';
  const isApproved = payment.status === 'approved';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to="/mis-pagos" className="text-sm text-emerald-400 hover:text-emerald-300 underline">Ver mis pagos</Link>
      <div className="card mt-5 p-6 md:p-8 border border-slate-700">
        <p className="eyebrow">{payment.tenants?.name || 'Pago del club'}</p>
        <h1 className="section-title text-3xl mt-1">Completar pago</h1>
        <p className="text-gray-300 mt-2">{payment.purchase_data?.description || 'Compra Tribuna 360'}</p>
        {payment.purchase_type === 'store' && (
          <p className="text-sm text-gray-400 mt-2">
            Compra a nombre de {payment.users?.full_name || payment.users?.email || 'tu cuenta'}.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <strong className="text-2xl text-emerald-300">Bs {Number(payment.amount).toLocaleString('es-BO')}</strong>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-200">
            {STATUS_LABELS[payment.status] || payment.status}
          </span>
        </div>
        {promoCode && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm">
            <p className="font-semibold text-emerald-200">Código promocional aplicado: {promoCode}</p>
            <p className="mt-1 text-gray-300">
              Ahorraste Bs {promoDiscount.toLocaleString('es-BO')}.
              {payment.purchase_data?.promo_description ? ` ${payment.purchase_data.promo_description}` : ''}
            </p>
          </div>
        )}
        {payment.purchase_type === 'ticket' && ticketDiscount && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm">
            <p className="font-semibold text-emerald-200">Descuento aplicado: {ticketDiscount.campaign_title}</p>
            <p className="mt-1 text-gray-300">
              Bs {Number(ticketDiscount.original_unit_price).toLocaleString('es-BO')} → Bs {Number(ticketDiscount.final_unit_price).toLocaleString('es-BO')} por entrada
              {' · '}ahorras Bs {Number(payment.purchase_data?.campaign_ticket_discount_total || 0).toLocaleString('es-BO')}
            </p>
          </div>
        )}
        {['membership', 'membership_renewal'].includes(payment.purchase_type) && membershipDiscount && (
          <div className="mt-3 rounded-lg border border-violet-800 bg-violet-950/40 p-3 text-sm">
            <p className="font-semibold text-violet-200">Descuento aplicado: {membershipDiscount.campaign_title}</p>
            <p className="mt-1 text-gray-300">
              Plan {membershipDiscount.plan_name}: Bs {Number(membershipDiscount.original_price).toLocaleString('es-BO')}
              {' → '}Bs {Number(membershipDiscount.final_price).toLocaleString('es-BO')}
              {' · '}ahorras Bs {Number(membershipDiscount.discount_amount).toLocaleString('es-BO')}
            </p>
          </div>
        )}
        {payment.expires_at && payment.status === 'awaiting_proof' && (
          <p className="text-xs text-amber-200 mt-2">
            Envía el comprobante antes de {new Date(payment.expires_at).toLocaleString('es-BO')}.
          </p>
        )}
        {payment.purchase_type === 'store' && purchaseItems.length > 0 && (
          <section className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h2 className="font-bold text-gray-200">Resumen de productos</h2>
            <ul className="mt-2 divide-y divide-slate-700">
              {purchaseItems.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-4 py-2 text-sm">
                  <span className="text-gray-300">{item.name} × {item.quantity}</span>
                  <span className="shrink-0 text-gray-200">Bs {Number(item.total).toLocaleString('es-BO')}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-4 border-t border-slate-700 pt-3 mt-2 text-sm">
              <span className="text-gray-300">Productos</span>
              <span>Bs {productSubtotal.toLocaleString('es-BO')}</span>
            </div>
            {delivery && (
              <div className="flex justify-between gap-4 mt-2 text-sm">
                <span className="text-gray-300">Envío ({delivery.method === 'home' ? 'domicilio' : 'punto acordado'})</span>
                <span>Bs {Number(delivery.fee || 0).toLocaleString('es-BO')}</span>
              </div>
            )}
            <div className="flex justify-between gap-4 mt-2 text-sm font-bold text-emerald-300">
              <span>Total QR</span>
              <span>Bs {Number(payment.amount).toLocaleString('es-BO')}</span>
            </div>
          </section>
        )}
        {payment.purchase_type === 'store' && delivery && (
          <section className="mt-5 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h2 className="font-bold text-gray-200">Datos de entrega</h2>
            <p className="text-sm text-gray-300 mt-2">
              Recibe {delivery.recipient_name} · {delivery.phone}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {delivery.method === 'home'
                ? [delivery.street, delivery.number && `N.º ${delivery.number}`, delivery.zone, delivery.city].filter(Boolean).join(', ')
                : [delivery.location, delivery.city].filter(Boolean).join(', ')}
              {delivery.department ? `, ${delivery.department}` : ''}
              {delivery.reference ? ` · Ref.: ${delivery.reference}` : ''}
            </p>
            <p className="text-xs text-slate-400 mt-2">El costo de envío ya está incluido en el total QR.</p>
          </section>
        )}

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 p-4">
            <h2 className="font-bold text-emerald-300">QR del club</h2>
            {settings?.qr_image_url ? (
              <img src={settings.qr_image_url} alt={`QR de pago de ${payment.tenants?.name || 'el club'}`} className="w-full max-w-xs mx-auto mt-3 rounded-lg bg-white p-2" />
            ) : (
              <p className="text-sm text-amber-200 mt-3">El club todavía no configuró su QR. Contacta al club antes de pagar.</p>
            )}
            {settings?.account_name && <p className="text-sm text-gray-200 mt-3">Titular: {settings.account_name}</p>}
            {settings?.payment_instructions && <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{settings.payment_instructions}</p>}
          </section>
          <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
            <h2 className="font-bold text-gray-200">Tarjeta de crédito</h2>
            <p className="text-sm text-gray-400 mt-3">
              Método separado del QR. Se habilitará cuando Tribuna 360 integre un proveedor compatible con Bolivia.
            </p>
            <button type="button" disabled className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm text-gray-400 cursor-not-allowed">
              No disponible todavía
            </button>
          </section>
        </div>

        <AlertBanner message={notice} type="success" onClose={() => setNotice(null)} className="mt-5 rounded-lg bg-emerald-950 p-3 text-emerald-200" />
        <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mt-5 rounded-lg bg-red-950 p-3 text-red-200" />
        {payment.status === 'pending_review' && (
          <p className="mt-5 rounded-lg bg-amber-950 p-4 text-amber-200">
            Recibimos tu comprobante. No vuelvas a pagar; el club lo revisará y te mostrará aquí la decisión.
          </p>
        )}
        {isApproved && (
          <p className="mt-5 rounded-lg bg-emerald-950 p-4 text-emerald-200">
            Pago confirmado. Tu compra ya está habilitada en Entradas, Pedidos o Membresía.
          </p>
        )}
        {payment.status === 'rejected' && (
          <p className="mt-5 rounded-lg bg-red-950 p-4 text-red-200">
            El pago fue rechazado y la reserva se liberó. Motivo: {payment.review_note || 'El club no confirmó el pago.'}
          </p>
        )}
        {payment.status === 'cancelled' && (
          <p className="mt-5 rounded-lg bg-slate-800 p-4 text-gray-200">
            La reserva venció o fue cancelada. {payment.review_note || 'Inicia una nueva compra para volver a intentar el pago.'}
          </p>
        )}
        {payment.status === 'pending_review' && (
          <button type="button" onClick={loadPayment} className="mt-3 text-sm text-emerald-300 underline">
            Actualizar estado del pago
          </button>
        )}

        {isAwaitingProof && (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <h2 className="text-lg font-bold">Envía tu comprobante</h2>
            <label className="block text-sm text-gray-300">
              Foto o PDF (máximo 5 MB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                required
                onChange={event => setFile(event.target.files?.[0] || null)}
                className="block w-full mt-2 text-sm text-gray-300"
              />
            </label>
            <label className="block text-sm text-gray-300">
              Nota opcional
              <textarea value={buyerNote} maxLength={500} onChange={event => setBuyerNote(event.target.value)} className="w-full mt-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-white" rows="2" />
            </label>
            <button type="submit" disabled={sending || !settings?.qr_image_url} className="btn btn-primary w-full py-3 disabled:opacity-50">
              {sending ? 'Enviando comprobante...' : 'Enviar para revisión'}
            </button>
          </form>
        )}
        <p className="mt-5 text-xs text-gray-500">
          El pago QR se acredita únicamente cuando un encargado del club confirma el comprobante. No aceptes solicitudes de claves o datos de tarjeta.
        </p>
      </div>
    </div>
  );
}

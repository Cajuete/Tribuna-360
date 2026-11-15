import { useEffect, useState } from 'react';
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

  const loadPayment = () => paymentService.get(paymentId)
    .then(res => setPayment(res.data))
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPayment();
  }, [paymentId]);

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
  const isAwaitingProof = payment.status === 'awaiting_proof';
  const isApproved = payment.status === 'approved';

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link to="/mis-pagos" className="text-sm text-emerald-400 hover:text-emerald-300 underline">Ver mis pagos</Link>
      <div className="card mt-5 p-6 md:p-8 border border-slate-700">
        <p className="eyebrow">{payment.tenants?.name || 'Pago del club'}</p>
        <h1 className="section-title text-3xl mt-1">Completar pago</h1>
        <p className="text-gray-300 mt-2">{payment.purchase_data?.description || 'Compra Tribuna 360'}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <strong className="text-2xl text-emerald-300">Bs {Number(payment.amount).toLocaleString('es-BO')}</strong>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-200">
            {STATUS_LABELS[payment.status] || payment.status}
          </span>
        </div>
        {payment.expires_at && payment.status === 'awaiting_proof' && (
          <p className="text-xs text-amber-200 mt-2">
            Envía el comprobante antes de {new Date(payment.expires_at).toLocaleString('es-BO')}.
          </p>
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

        {notice && <p className="mt-5 rounded-lg bg-emerald-950 p-3 text-emerald-200">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
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

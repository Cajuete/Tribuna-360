import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentService } from '../api/payment.service';

const STATUS_LABELS = {
  awaiting_proof: 'Esperando comprobante',
  pending_review: 'En revisión',
  approved: 'Confirmado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};
const TYPE_LABELS = {
  ticket: 'Entradas',
  store: 'Tienda',
  membership: 'Membresía',
  membership_renewal: 'Renovación de membresía',
};

export default function MyPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    paymentService.getMine()
      .then(response => setPayments(response.data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Mis pagos</h1>
      {loading && <p className="text-gray-400">Cargando pagos...</p>}
      {error && <p className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {!loading && !error && payments.length === 0 && (
        <p className="rounded-xl border border-slate-700 bg-slate-800 p-6 text-gray-300">Todavía no tienes pagos iniciados.</p>
      )}
      <div className="space-y-3">
        {payments.map(payment => (
          <article key={payment.id} className="rounded-xl border border-slate-700 bg-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">{payment.tenants?.name} · {TYPE_LABELS[payment.purchase_type] || payment.purchase_type}</p>
              <h2 className="font-semibold mt-1">{payment.purchase_data?.description || 'Compra'}</h2>
              <p className="text-sm text-emerald-300 mt-1">Bs {Number(payment.amount).toLocaleString('es-BO')}</p>
              {payment.review_note && <p className="text-xs text-amber-200 mt-2">Nota del club: {payment.review_note}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs">{STATUS_LABELS[payment.status] || payment.status}</span>
              <Link to={`/pagar/${payment.id}`} className="text-sm text-emerald-300 underline">
                {payment.status === 'awaiting_proof' ? 'Pagar' : 'Ver detalle'}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import AlertBanner from '../components/AlertBanner';
import { useCallback, useEffect, useRef, useState } from 'react';
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
const STATUS_STYLES = {
  awaiting_proof: 'bg-slate-700 text-gray-200',
  pending_review: 'bg-amber-900 text-amber-200',
  approved: 'bg-emerald-900 text-emerald-200',
  rejected: 'bg-red-900 text-red-200',
  cancelled: 'bg-gray-700 text-gray-300',
};
const inputClass = 'w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white';

export default function PaymentsDashboard({ user, tenants = [] }) {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('pending_review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [settings, setSettings] = useState({ account_name: '', payment_instructions: '', qr_image_url: '' });
  const qrInputRef = useRef(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const canReview = ['superadmin', 'club_admin', 'payment_manager'].includes(user?.role);

  const loadPayments = useCallback(() => {
    setLoading(true);
    setError(null);
    paymentService.getAll(filter === 'all' ? undefined : filter)
      .then(response => setPayments(response.data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    paymentService.getAll(filter === 'all' ? undefined : filter)
      .then(response => setPayments(response.data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  const activeSelectedTenantId = user?.role === 'superadmin'
    ? (selectedTenantId || tenants[0]?.id || '')
    : user?.tenant_id;
  const activeTenantId = activeSelectedTenantId;
  const canConfigure = ['superadmin', 'club_admin', 'payment_manager'].includes(user?.role) && Boolean(activeTenantId);
  const canEditSettings = ['superadmin', 'payment_manager'].includes(user?.role);

  useEffect(() => {
    if (!canConfigure) return undefined;
    let cancelled = false;
    paymentService.getSettings(activeTenantId)
      .then(response => {
        if (!cancelled) setSettings({
          account_name: response.data.account_name || '',
          payment_instructions: response.data.payment_instructions || '',
          qr_image_url: response.data.qr_image_url || '',
        });
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [activeTenantId, canConfigure]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await paymentService.updateSettings({
        tenant_id: activeTenantId,
        account_name: settings.account_name,
        payment_instructions: settings.payment_instructions,
      });
      setSettings(current => ({ ...current, ...saved.data }));
      setNotice('Datos del QR guardados. Los pagos llegan directamente a la cuenta del club.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const uploadQr = async (file) => {
    if (!file) return;
    setUploadingQr(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await paymentService.uploadQr(file, activeTenantId);
      setSettings(current => ({ ...current, qr_image_url: uploaded.data.qr_image_url }));
      setNotice('Imagen del QR subida correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingQr(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const resolve = async (payment, decision) => {
    const note = (reviewNotes[payment.id] || '').trim();
    if (decision === 'rejected' && !note) {
      setError('Escribe el motivo antes de rechazar un pago.');
      return;
    }
    if (!window.confirm(decision === 'approved'
      ? '¿Confirmas que verificaste el abono en la cuenta del club? La compra se habilitará inmediatamente.'
      : '¿Rechazar este comprobante? La reserva de entradas o stock se liberará.')) return;
    setError(null);
    setNotice(null);
    try {
      const response = await paymentService.resolve(payment.id, decision, note);
      setNotice(response.message);
      loadPayments();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold">Bandeja de pagos</h2>
        <p className="text-sm text-gray-400 mt-1">Las compras solo se habilitan cuando un encargado confirma el abono en la cuenta del club.</p>
      </header>

      {canConfigure && (
        canEditSettings ? (
        <form onSubmit={saveSettings} className="rounded-2xl border border-gray-700 bg-gray-800 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">QR y cuenta del club</h3>
            <p className="text-xs text-gray-400 mt-1">Este QR se muestra en el checkout de entradas, tienda y membresías.</p>
          </div>
          {user?.role === 'superadmin' && (
            <label className="block text-sm text-gray-300">
              Club
              <select value={activeTenantId} onChange={event => setSelectedTenantId(event.target.value)} required className={`${inputClass} mt-1`}>
                {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </label>
          )}
          {settings.qr_image_url && (
            <img src={settings.qr_image_url} alt="QR configurado del club" className="w-40 rounded-lg bg-white p-2" />
          )}
          <input
            ref={qrInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={event => uploadQr(event.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => qrInputRef.current?.click()}
            disabled={uploadingQr || !activeTenantId}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
          >
            {uploadingQr ? 'Subiendo QR...' : settings.qr_image_url ? 'Cambiar imagen del QR' : 'Subir imagen del QR'}
          </button>
          <p className="text-xs text-gray-400">PNG, JPG o WEBP · máximo 2 MB. Al elegir la imagen, se subirá automáticamente.</p>
          <label className="block text-sm text-gray-300">
            Titular de la cuenta
            <input value={settings.account_name} maxLength={160} onChange={event => setSettings(current => ({ ...current, account_name: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm text-gray-300">
            Instrucciones para pagar
            <textarea value={settings.payment_instructions} maxLength={1000} rows={3} onChange={event => setSettings(current => ({ ...current, payment_instructions: event.target.value }))} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" disabled={savingSettings || !activeTenantId} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {savingSettings ? 'Guardando...' : 'Guardar titular e instrucciones'}
          </button>
        </form>
        ) : (
          <section className="rounded-2xl border border-gray-700 bg-gray-800 p-5 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">QR y cuenta del club</h3>
              <p className="text-xs text-gray-400 mt-1">Información configurada por el encargado de pagos. Solo lectura.</p>
            </div>
            {settings.qr_image_url
              ? <img src={settings.qr_image_url} alt="QR configurado del club" className="w-40 rounded-lg bg-white p-2" />
              : <p className="text-sm text-gray-400">El encargado de pagos aún no ha cargado un QR.</p>}
            <div>
              <p className="text-xs text-gray-400">Titular de la cuenta</p>
              <p className="text-sm text-white">{settings.account_name || 'No configurado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Instrucciones para pagar</p>
              <p className="text-sm text-white whitespace-pre-wrap">{settings.payment_instructions || 'No configuradas'}</p>
            </div>
          </section>
        )
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">Pagos de compras</h3>
          <div className="flex gap-2">
            <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white">
              <option value="pending_review">Por revisar</option>
              <option value="awaiting_proof">Esperando comprobante</option>
              <option value="approved">Confirmados</option>
              <option value="rejected">Rechazados</option>
              <option value="all">Todos</option>
            </select>
            <button type="button" onClick={loadPayments} className="rounded-lg bg-gray-700 px-3 py-2 text-sm">Actualizar</button>
          </div>
        </div>
        <AlertBanner message={notice} type="success" onClose={() => setNotice(null)} className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" />
        <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200" />
        {loading && <p className="text-sm text-gray-400">Cargando pagos...</p>}
        {!loading && payments.length === 0 && <p className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm text-gray-400">No hay pagos en esta bandeja.</p>}

        <div className="space-y-4">
          {payments.map(payment => (
            <article key={payment.id} className="rounded-xl border border-gray-700 bg-gray-800 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{TYPE_LABELS[payment.purchase_type] || payment.purchase_type}: {payment.purchase_data?.description}</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {payment.users?.full_name || payment.users?.email} · {payment.tenants?.name} · {new Date(payment.created_at).toLocaleString('es-BO')}
                  </p>
                  <p className="text-lg font-semibold text-emerald-300 mt-2">Bs {Number(payment.amount).toLocaleString('es-BO')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLES[payment.status] || 'bg-gray-700'}`}>
                  {STATUS_LABELS[payment.status] || payment.status}
                </span>
              </div>
              {payment.proof_url ? (
                <a href={payment.proof_url} target="_blank" rel="noreferrer" className="inline-flex text-sm text-emerald-300 underline">Abrir comprobante privado</a>
              ) : (
                <p className="text-xs text-gray-500">Aún no se adjuntó comprobante.</p>
              )}
              {payment.buyer_note && <p className="text-sm text-gray-300">Nota del comprador: {payment.buyer_note}</p>}
              {payment.review_note && <p className="text-sm text-amber-200">Nota de revisión: {payment.review_note}</p>}
              {canReview && payment.status === 'pending_review' && (
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <label className="block text-xs text-gray-400">
                    Nota (obligatoria para rechazar)
                    <textarea value={reviewNotes[payment.id] || ''} maxLength={2000} rows={2} onChange={event => setReviewNotes(current => ({ ...current, [payment.id]: event.target.value }))} className={`${inputClass} mt-1`} />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => resolve(payment, 'rejected')} className="rounded-lg bg-red-800 px-4 py-2 text-sm text-white">Rechazar</button>
                    <button type="button" onClick={() => resolve(payment, 'approved')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Confirmar pago</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

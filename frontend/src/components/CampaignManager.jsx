import { useCallback, useEffect, useState } from 'react';
import { campaignService } from '../api/campaign.service';
import { productService } from '../api/product.service';
import { matchService } from '../api/match.service';
import { membershipService } from '../api/membership.service';
import { uploadService } from '../api/upload.service';
import AlertBanner from './AlertBanner';

const inputClass = 'w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white';
const labelClass = 'text-xs text-gray-400 block mb-1';
const LOCATIONS = [
  { value: 'home', label: 'Página principal' },
  { value: 'club', label: 'Página del club' },
  { value: 'store', label: 'Tienda' },
  { value: 'matches', label: 'Partidos y entradas' },
  { value: 'memberships', label: 'Planes de socios' },
];

const emptyForm = () => ({
  title: '',
  description: '',
  banner_image_url: '',
  placements: ['home', 'club', 'store', 'matches'],
  targets: ['store'],
  starts_at: '',
  ends_at: '',
  is_active: true,
  offers: [{ product_id: '', discount_type: 'percentage', discount_value: '' }],
  ticket_offers: [],
  membership_offers: [],
});

const localDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const displayDate = value => new Date(value).toLocaleString('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const userFacingError = (error, fallback) => {
  const message = error?.message || '';
  if (/could not|schema cache|relation|column|pgrst|duplicate key/i.test(message)) return fallback;
  return message || fallback;
};

export default function CampaignManager({ tenantId, isSuperadmin }) {
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [matches, setMatches] = useState([]);
  const [zonesByMatch, setZonesByMatch] = useState({});
  const [loadingZonesFor, setLoadingZonesFor] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const loadData = useCallback(async () => {
    if (isSuperadmin && !tenantId) {
      setCampaigns([]);
      setProducts([]);
      setMembershipPlans([]);
      setMatches([]);
      setZonesByMatch({});
      return;
    }

    const query = isSuperadmin ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
    const [campaignResult, productResult, matchResult, membershipResult] = await Promise.allSettled([
      campaignService.getAll(query),
      productService.getAll(query),
      matchService.getAllMatches(query),
      membershipService.getPlans(isSuperadmin ? tenantId : undefined),
    ]);

    if (campaignResult.status === 'fulfilled' && campaignResult.value.success) {
      setCampaigns(campaignResult.value.data || []);
    } else if (campaignResult.status === 'rejected') {
      console.error('[Campaigns] No se pudieron cargar las campañas:', campaignResult.reason);
      setMessage({ type: 'error', text: userFacingError(campaignResult.reason, 'No se pudieron cargar las campañas. Verifica la configuración del módulo.') });
    }

    if (productResult.status === 'fulfilled' && productResult.value.success) {
      setProducts(productResult.value.data || []);
    } else if (productResult.status === 'rejected') {
      console.error('[Campaigns] No se pudieron cargar los productos:', productResult.reason);
      setMessage({ type: 'error', text: 'No se pudieron cargar los productos del club.' });
    }

    if (matchResult.status === 'fulfilled' && matchResult.value.status === 'success') {
      setMatches(matchResult.value.data || []);
    } else if (matchResult.status === 'rejected') {
      console.error('[Campaigns] No se pudieron cargar los partidos:', matchResult.reason);
      setMessage({ type: 'error', text: 'No se pudieron cargar los partidos del club.' });
    } else if (matchResult.status === 'fulfilled') {
      setMessage({ type: 'error', text: matchResult.value.message || 'No se pudieron cargar los partidos.' });
    }

    if (membershipResult.status === 'fulfilled' && membershipResult.value.status === 'success') {
      setMembershipPlans(membershipResult.value.data || []);
    } else if (membershipResult.status === 'rejected') {
      console.error('[Campaigns] No se pudieron cargar los planes de socio:', membershipResult.reason);
      setMessage({ type: 'error', text: 'No se pudieron cargar los planes de socio del club.' });
    } else if (membershipResult.status === 'fulfilled') {
      setMessage({ type: 'error', text: membershipResult.value.message || 'No se pudieron cargar los planes de socio.' });
    }
  }, [isSuperadmin, tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormErrors({});
  };

  const updateOffer = (index, key, value) => {
    setForm(current => ({
      ...current,
      offers: current.offers.map((offer, offerIndex) => (
        offerIndex === index ? { ...offer, [key]: value } : offer
      )),
    }));
  };

  const updateTicketOffer = (index, key, value) => {
    setForm(current => ({
      ...current,
      ticket_offers: current.ticket_offers.map((offer, offerIndex) => (
        offerIndex === index
          ? { ...offer, [key]: value, ...(key === 'match_id' ? { zone_id: '' } : {}) }
          : offer
      )),
    }));
  };

  const updateMembershipOffer = (index, key, value) => {
    setForm(current => ({
      ...current,
      membership_offers: current.membership_offers.map((offer, offerIndex) => (
        offerIndex === index ? { ...offer, [key]: value } : offer
      )),
    }));
  };

  const loadZones = async matchId => {
    if (!matchId || zonesByMatch[matchId]) return;
    setLoadingZonesFor(matchId);
    try {
      const response = await matchService.getZones(matchId);
      if (response.status !== 'success') throw new Error(response.message || 'No se pudieron cargar las zonas.');
      setZonesByMatch(current => ({ ...current, [matchId]: response.data || [] }));
    } catch (error) {
      console.error('[Campaigns] No se pudieron cargar las zonas del partido:', error);
      setMessage({ type: 'error', text: 'No se pudieron cargar las zonas de este partido.' });
    } finally {
      setLoadingZonesFor('');
    }
  };

  const toggleDiscountTarget = target => {
    setForm(current => {
      const targets = current.targets.includes(target)
        ? current.targets.filter(item => item !== target)
        : [...current.targets, target];
      return {
        ...current,
        targets,
        placements: target === 'memberships' && targets.includes(target) && !current.placements.includes('memberships')
          ? [...current.placements, 'memberships']
          : current.placements,
        offers: target === 'store' && targets.includes(target) && current.offers.length === 0
          ? [{ product_id: '', discount_type: 'percentage', discount_value: '' }]
          : current.offers,
        ticket_offers: target === 'tickets' && targets.includes(target) && current.ticket_offers.length === 0
          ? [{ match_id: '', zone_id: '', discount_type: 'percentage', discount_value: '' }]
          : current.ticket_offers,
        membership_offers: target === 'memberships' && targets.includes(target) && current.membership_offers.length === 0
          ? [{ plan_id: '', discount_type: 'percentage', discount_value: '' }]
          : current.membership_offers,
      };
    });
  };

  const togglePlacement = placement => {
    setForm(current => ({
      ...current,
      placements: current.placements.includes(placement)
        ? current.placements.filter(value => value !== placement)
        : [...current.placements, placement],
    }));
  };

  const handleBannerUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'El banner debe ser PNG, JPG o WEBP y no superar 2 MB.' });
      event.target.value = '';
      return;
    }
    setUploadingBanner(true);
    setMessage(null);
    try {
      const response = await uploadService.campaignBanner(file);
      setForm(current => ({ ...current, banner_image_url: response.data.url }));
      setMessage({ type: 'success', text: 'Banner subido correctamente.' });
    } catch (error) {
      console.error('[Campaigns] No se pudo subir el banner:', error);
      setMessage({ type: 'error', text: error.message || 'No se pudo subir el banner.' });
    } finally {
      setUploadingBanner(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    const errors = {};
    const title = form.title.trim();
    const bannerUrl = form.banner_image_url.trim();
    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(form.ends_at);
    if (title.length < 2 || title.length > 120) errors.title = 'El nombre debe tener entre 2 y 120 caracteres.';
    if (form.description.trim().length > 500) errors.description = 'Usa hasta 500 caracteres.';
    if (!bannerUrl) errors.banner = 'Sube una imagen para el banner de la campaña.';
    if (!form.placements.length) errors.placements = 'Selecciona al menos una ubicación.';
    if (!form.starts_at || Number.isNaN(startsAt.getTime())) errors.starts_at = 'Indica cuándo empieza la campaña.';
    if (!form.ends_at || Number.isNaN(endsAt.getTime())) errors.ends_at = 'Indica cuándo termina la campaña.';
    else if (!Number.isNaN(startsAt.getTime()) && endsAt <= startsAt) errors.ends_at = 'La fecha de fin debe ser posterior al inicio.';
    if (!form.targets.length) errors.targets = 'Selecciona dónde quieres aplicar el descuento.';
    if (form.targets.includes('store') && (!form.offers.length || form.offers.some(offer => {
      const value = Number(offer.discount_value);
      return !offer.product_id || !Number.isFinite(value) || value <= 0 ||
        (offer.discount_type === 'percentage' && value > 100);
    }))) {
      errors.offers = 'Selecciona un producto y un descuento válido para cada oferta de tienda.';
    }
    const selectedProducts = form.targets.includes('store') ? form.offers.map(offer => offer.product_id) : [];
    if (new Set(selectedProducts).size !== selectedProducts.length) {
      errors.offers = 'Cada producto solo puede aparecer una vez en la campaña.';
    }
    if (form.targets.includes('tickets') && (!form.ticket_offers.length || form.ticket_offers.some(offer => {
      const value = Number(offer.discount_value);
      return !offer.match_id || !offer.zone_id || !Number.isFinite(value) || value <= 0 ||
        (offer.discount_type === 'percentage' && value > 100);
    }))) {
      errors.ticket_offers = 'Selecciona un partido, una zona y un descuento válido para cada oferta de entradas.';
    }
    const selectedTicketZones = form.targets.includes('tickets')
      ? form.ticket_offers.map(offer => `${offer.match_id}:${offer.zone_id}`)
      : [];
    if (new Set(selectedTicketZones).size !== selectedTicketZones.length) {
      errors.ticket_offers = 'Cada zona de un partido solo puede aparecer una vez en la campaña.';
    }
    if (form.targets.includes('memberships') && (!form.membership_offers.length || form.membership_offers.some(offer => {
      const value = Number(offer.discount_value);
      const plan = membershipPlans.find(item => item.id === offer.plan_id);
      const price = Number(plan?.price);
      const discount = offer.discount_type === 'percentage' ? price * value / 100 : value;
      return !offer.plan_id || !Number.isFinite(value) || value <= 0 ||
        !Number.isFinite(price) || price <= 0 || discount >= price ||
        (offer.discount_type === 'percentage' && value >= 100);
    }))) {
      errors.membership_offers = 'Selecciona un plan y un descuento menor al precio del plan.';
    }
    const selectedPlans = form.targets.includes('memberships')
      ? form.membership_offers.map(offer => offer.plan_id)
      : [];
    if (new Set(selectedPlans).size !== selectedPlans.length) {
      errors.membership_offers = 'Cada plan de socio solo puede aparecer una vez en la campaña.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setMessage({ type: 'error', text: 'Revisa los campos marcados antes de guardar.' });
      return;
    }
    if (isSuperadmin && !tenantId) {
      setMessage({ type: 'error', text: 'Selecciona un club antes de crear la campaña.' });
      return;
    }

    const payload = {
      title,
      description: form.description.trim(),
      banner_image_url: bannerUrl,
      placements: form.placements,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: form.is_active,
      offers: form.targets.includes('store') ? form.offers.map(offer => ({
        product_id: offer.product_id,
        discount_type: offer.discount_type,
        discount_value: Number(offer.discount_value),
      })) : [],
      ticket_offers: form.targets.includes('tickets') ? form.ticket_offers.map(offer => ({
        match_id: offer.match_id,
        zone_id: offer.zone_id,
        discount_type: offer.discount_type,
        discount_value: Number(offer.discount_value),
      })) : [],
      membership_offers: form.targets.includes('memberships') ? form.membership_offers.map(offer => ({
        plan_id: offer.plan_id,
        discount_type: offer.discount_type,
        discount_value: Number(offer.discount_value),
      })) : [],
      ...(isSuperadmin ? { tenant_id: tenantId } : {}),
    };

    setLoading(true);
    setMessage(null);
    try {
      if (editingId) {
        await campaignService.update(editingId, payload);
        setMessage({ type: 'success', text: 'Campaña actualizada.' });
      } else {
        await campaignService.create(payload);
        setMessage({ type: 'success', text: 'Campaña creada.' });
      }
      resetForm();
      await loadData();
    } catch (error) {
      console.error('[Campaigns] No se pudo guardar la campaña:', error);
      setMessage({ type: 'error', text: userFacingError(error, 'No se pudo guardar la campaña. Verifica la configuración del módulo.') });
    } finally {
      setLoading(false);
    }
  };

  const editCampaign = campaign => {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title || '',
      description: campaign.description || '',
      banner_image_url: campaign.banner_image_url || '',
      placements: campaign.placements || [],
      targets: [
        ...(campaign.campaign_offers?.length ? ['store'] : []),
        ...(campaign.campaign_ticket_offers?.length ? ['tickets'] : []),
        ...(campaign.campaign_membership_offers?.length ? ['memberships'] : []),
      ],
      starts_at: localDateTime(campaign.starts_at),
      ends_at: localDateTime(campaign.ends_at),
      is_active: campaign.is_active !== false,
      offers: (campaign.campaign_offers || []).map(offer => ({
        product_id: offer.product_id,
        discount_type: offer.discount_type,
        discount_value: String(offer.discount_value),
      })),
      ticket_offers: (campaign.campaign_ticket_offers || []).map(offer => ({
        match_id: offer.match_id,
        zone_id: offer.zone_id,
        discount_type: offer.discount_type,
        discount_value: String(offer.discount_value),
      })),
      membership_offers: (campaign.campaign_membership_offers || []).map(offer => ({
        plan_id: offer.plan_id,
        discount_type: offer.discount_type,
        discount_value: String(offer.discount_value),
      })),
    });
    [...new Set((campaign.campaign_ticket_offers || []).map(offer => offer.match_id))]
      .forEach(matchId => loadZones(matchId));
    setFormErrors({});
    setMessage(null);
  };

  const toggleActive = async campaign => {
    setMessage(null);
    try {
      await campaignService.setActive(campaign.id, !campaign.is_active);
      setMessage({ type: 'success', text: campaign.is_active ? 'Campaña pausada.' : 'Campaña activada.' });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const removeCampaign = async campaign => {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.title}" y todas sus ofertas?`)) return;
    setMessage(null);
    try {
      await campaignService.remove(campaign.id);
      if (editingId === campaign.id) resetForm();
      setMessage({ type: 'success', text: 'Campaña eliminada.' });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const formatOffer = offer => offer.discount_type === 'percentage'
    ? `${Number(offer.discount_value)}%`
    : `Bs ${Number(offer.discount_value).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
  const campaignStatus = campaign => {
    if (!campaign.is_active) return 'Pausada';
    const now = Date.now();
    if (now < new Date(campaign.starts_at).getTime()) return 'Programada';
    if (now > new Date(campaign.ends_at).getTime()) return 'Finalizada';
    return 'Vigente';
  };

  return (
    <div className="space-y-6">
      {isSuperadmin && !tenantId && (
        <p className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
          Escribe el ID del club para cargar sus productos y administrar sus campañas.
        </p>
      )}
      {message && (
        <AlertBanner
          message={message.text}
          type={message.type}
          onClose={() => setMessage(null)}
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="bg-gray-800 p-5 rounded-2xl border border-gray-700 space-y-5">
        <div>
          <h2 className="text-lg font-bold">{editingId ? 'Editar campaña' : 'Crear campaña'}</h2>
          <p className="text-xs text-gray-400 mt-1">
            El banner se muestra durante las fechas elegidas. Selecciona por separado dónde aparece y a qué compra se aplica el descuento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>
            <span className={labelClass}>Nombre de la campaña</span>
            <input maxLength={120} className={inputClass} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required />
            {formErrors.title && <span className="text-xs text-rose-400 mt-1 block">{formErrors.title}</span>}
          </label>
          <label>
            <span className={labelClass}>Imagen del banner</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBannerUpload} disabled={uploadingBanner} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-emerald-700 file:px-3 file:py-1 file:text-white`} />
            <span className="text-[11px] text-gray-500 mt-1 block">PNG, JPG o WEBP · máximo 2 MB</span>
            {uploadingBanner && <span className="text-xs text-emerald-300 mt-1 block">Subiendo banner...</span>}
            {form.banner_image_url && (
              <div className="mt-2 space-y-2">
                <img src={form.banner_image_url} alt="Vista previa del banner" className="w-full max-h-64 object-contain bg-gray-950 rounded-lg" />
                <button type="button" onClick={() => setForm({ ...form, banner_image_url: '' })} className="text-xs text-rose-300 hover:text-rose-200">
                  Quitar banner
                </button>
              </div>
            )}
            {formErrors.banner && <span className="text-xs text-rose-400 mt-1 block">{formErrors.banner}</span>}
          </label>
          <label className="md:col-span-2">
            <span className={labelClass}>Descripción (opcional)</span>
            <textarea maxLength={500} rows={2} className={inputClass} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
            {formErrors.description && <span className="text-xs text-rose-400 mt-1 block">{formErrors.description}</span>}
          </label>
        </div>

        <fieldset>
          <legend className={labelClass}>¿En qué páginas verá el hincha este banner?</legend>
          <div className="flex flex-wrap gap-3 mt-2">
            {LOCATIONS.map(location => (
              <label key={location.value} className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.placements.includes(location.value)} onChange={() => togglePlacement(location.value)} />
                {location.label}
              </label>
            ))}
          </div>
          {formErrors.placements && <span className="text-xs text-rose-400 mt-1 block">{formErrors.placements}</span>}
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label>
            <span className={labelClass}>Desde</span>
            <input type="datetime-local" className={inputClass} value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })} required />
            {formErrors.starts_at && <span className="text-xs text-rose-400 mt-1 block">{formErrors.starts_at}</span>}
          </label>
          <label>
            <span className={labelClass}>Hasta</span>
            <input type="datetime-local" className={inputClass} value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })} required />
            {formErrors.ends_at && <span className="text-xs text-rose-400 mt-1 block">{formErrors.ends_at}</span>}
          </label>
        </div>

        <fieldset className="space-y-4">
          <legend className={labelClass}>¿Dónde se aplicará el descuento?</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.targets.includes('store')} onChange={() => toggleDiscountTarget('store')} />
              Productos de la tienda
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.targets.includes('tickets')} onChange={() => toggleDiscountTarget('tickets')} />
              Entradas para partidos
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.targets.includes('memberships')} onChange={() => toggleDiscountTarget('memberships')} />
              Planes de socios
            </label>
          </div>
          {formErrors.targets && <span className="text-xs text-rose-400 block">{formErrors.targets}</span>}

          {form.targets.includes('store') && (
            <div className="space-y-3 rounded-xl border border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Ofertas para la tienda</h3>
                <button type="button" onClick={() => setForm(current => ({
                  ...current,
                  offers: [...current.offers, { product_id: '', discount_type: 'percentage', discount_value: '' }],
                  }))} disabled={form.offers.length + form.ticket_offers.length + form.membership_offers.length >= 30} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                  + Agregar producto
                </button>
              </div>
              {form.offers.map((offer, index) => (
                <div key={`${index}-${offer.product_id}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-3 items-end rounded-xl border border-gray-700 bg-gray-900/50 p-3">
                  <label>
                    <span className={labelClass}>Producto</span>
                    <select className={inputClass} value={offer.product_id} onChange={event => updateOffer(index, 'product_id', event.target.value)} required>
                      <option value="">Selecciona un producto</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>{product.name} · Bs {product.price}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Tipo de descuento</span>
                    <select className={inputClass} value={offer.discount_type} onChange={event => updateOffer(index, 'discount_type', event.target.value)}>
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo (Bs)</option>
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Valor</span>
                    <input type="number" min="0.01" max={offer.discount_type === 'percentage' ? 100 : undefined} step="0.01" className={inputClass} value={offer.discount_value} onChange={event => updateOffer(index, 'discount_value', event.target.value)} required />
                  </label>
                  <button type="button" disabled={form.offers.length === 1} onClick={() => setForm(current => ({
                    ...current,
                    offers: current.offers.filter((_, offerIndex) => offerIndex !== index),
                  }))} className="px-3 py-3 rounded-lg bg-gray-700 text-gray-200 hover:bg-red-900 disabled:opacity-40 disabled:hover:bg-gray-700">
                    Quitar
                  </button>
                </div>
              ))}
              {formErrors.offers && <span className="text-xs text-rose-400 block">{formErrors.offers}</span>}
            </div>
          )}

          {form.targets.includes('tickets') && (
            <div className="space-y-3 rounded-xl border border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Ofertas para entradas</h3>
                  <p className="text-xs text-gray-400 mt-1">Elige el partido y la zona donde se descontará el precio.</p>
                </div>
                <button type="button" onClick={() => setForm(current => ({
                  ...current,
                  ticket_offers: [...current.ticket_offers, { match_id: '', zone_id: '', discount_type: 'percentage', discount_value: '' }],
                }))} disabled={form.offers.length + form.ticket_offers.length + form.membership_offers.length >= 30} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                  + Agregar zona
                </button>
              </div>
              {form.ticket_offers.map((offer, index) => (
                <div key={`${index}-${offer.match_id}-${offer.zone_id}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_auto] gap-3 items-end rounded-xl border border-gray-700 bg-gray-900/50 p-3">
                  <label>
                    <span className={labelClass}>Partido</span>
                    <select className={inputClass} value={offer.match_id} onChange={event => {
                      const matchId = event.target.value;
                      updateTicketOffer(index, 'match_id', matchId);
                      loadZones(matchId);
                    }} required>
                      <option value="">Selecciona un partido</option>
                      {matches.filter(match => match.status === 'scheduled' && new Date(match.match_date) >= new Date()).map(match => (
                        <option key={match.id} value={match.id}>
                          {match.tenants?.name ? `${match.tenants.name} · ` : ''}vs. {match.opponent} · {new Date(match.match_date).toLocaleDateString('es-BO')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Zona</span>
                    <select className={inputClass} value={offer.zone_id} onChange={event => updateTicketOffer(index, 'zone_id', event.target.value)} disabled={!offer.match_id || loadingZonesFor === offer.match_id} required>
                      <option value="">{loadingZonesFor === offer.match_id ? 'Cargando zonas...' : 'Selecciona una zona'}</option>
                      {(zonesByMatch[offer.match_id] || []).filter(zone => zone.is_enabled && zone.sale_mode === 'general').map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name} · Bs {zone.price}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Tipo de descuento</span>
                    <select className={inputClass} value={offer.discount_type} onChange={event => updateTicketOffer(index, 'discount_type', event.target.value)}>
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo (Bs)</option>
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Valor</span>
                    <input type="number" min="0.01" max={offer.discount_type === 'percentage' ? 100 : undefined} step="0.01" className={inputClass} value={offer.discount_value} onChange={event => updateTicketOffer(index, 'discount_value', event.target.value)} required />
                  </label>
                  <button type="button" onClick={() => setForm(current => ({
                    ...current,
                    ticket_offers: current.ticket_offers.filter((_, offerIndex) => offerIndex !== index),
                  }))} className="px-3 py-3 rounded-lg bg-gray-700 text-gray-200 hover:bg-red-900">
                    Quitar
                  </button>
                </div>
              ))}
              {formErrors.ticket_offers && <span className="text-xs text-rose-400 block">{formErrors.ticket_offers}</span>}
            </div>
          )}

          {form.targets.includes('memberships') && (
            <div className="space-y-3 rounded-xl border border-gray-700 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Ofertas para planes de socios</h3>
                  <p className="text-xs text-gray-400 mt-1">El descuento se resta del pago al asociarse o renovar.</p>
                </div>
                <button type="button" onClick={() => setForm(current => ({
                  ...current,
                  membership_offers: [...current.membership_offers, { plan_id: '', discount_type: 'percentage', discount_value: '' }],
                }))} disabled={form.offers.length + form.ticket_offers.length + form.membership_offers.length >= 30} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">
                  + Agregar plan
                </button>
              </div>
              {form.membership_offers.map((offer, index) => (
                <div key={`${index}-${offer.plan_id}`} className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] gap-3 items-end rounded-xl border border-gray-700 bg-gray-900/50 p-3">
                  <label>
                    <span className={labelClass}>Plan de socio</span>
                    <select className={inputClass} value={offer.plan_id} onChange={event => updateMembershipOffer(index, 'plan_id', event.target.value)} required>
                      <option value="">Selecciona un plan</option>
                      {membershipPlans.map(plan => (
                        <option key={plan.id} value={plan.id}>{plan.tenants?.name ? `${plan.tenants.name} · ` : ''}{plan.name} · Bs {plan.price}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Tipo de descuento</span>
                    <select className={inputClass} value={offer.discount_type} onChange={event => updateMembershipOffer(index, 'discount_type', event.target.value)}>
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Monto fijo (Bs)</option>
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Valor</span>
                    <input type="number" min="0.01" max={offer.discount_type === 'percentage' ? 99.99 : undefined} step="0.01" className={inputClass} value={offer.discount_value} onChange={event => updateMembershipOffer(index, 'discount_value', event.target.value)} required />
                  </label>
                  <button type="button" onClick={() => setForm(current => ({
                    ...current,
                    membership_offers: current.membership_offers.filter((_, offerIndex) => offerIndex !== index),
                  }))} className="px-3 py-3 rounded-lg bg-gray-700 text-gray-200 hover:bg-red-900">
                    Quitar
                  </button>
                </div>
              ))}
              {formErrors.membership_offers && <span className="text-xs text-rose-400 block">{formErrors.membership_offers}</span>}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} />
            Campaña activa
          </label>
          <button type="submit" disabled={loading || uploadingBanner || (isSuperadmin && !tenantId)} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-lg">
            {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear campaña'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-3 rounded-lg">
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">Campañas del club</h2>
        {campaigns.length === 0 ? (
          <p className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-xl p-5">
            No hay campañas creadas todavía.
          </p>
        ) : campaigns.map(campaign => (
          <article key={campaign.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{campaign.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {displayDate(campaign.starts_at)} — {displayDate(campaign.ends_at)}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(campaign.campaign_offers || []).map(offer => (
                    <span key={offer.id} className="rounded-full bg-emerald-950 border border-emerald-800 px-3 py-1 text-xs text-emerald-200">
                      {formatOffer(offer)} en {offer.products?.name || 'Producto'}
                    </span>
                  ))}
                  {(campaign.campaign_ticket_offers || []).map(offer => (
                    <span key={offer.id} className="rounded-full bg-sky-950 border border-sky-800 px-3 py-1 text-xs text-sky-200">
                      {formatOffer(offer)} en {offer.zones?.name || 'Zona'} · {offer.matches?.opponent || 'Partido'}
                    </span>
                  ))}
                  {(campaign.campaign_membership_offers || []).map(offer => (
                    <span key={offer.id} className="rounded-full bg-violet-950 border border-violet-800 px-3 py-1 text-xs text-violet-200">
                      {formatOffer(offer)} en {offer.membership_plans?.name || 'Plan de socio'}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ubicaciones: {(campaign.placements || []).map(value => LOCATIONS.find(location => location.value === value)?.label || value).join(', ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-3 py-1.5 rounded-full ${campaign.is_active ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
                  {campaignStatus(campaign)}
                </span>
                <button type="button" onClick={() => editCampaign(campaign)} className="bg-sky-800 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-lg">
                  Editar
                </button>
                <button type="button" onClick={() => toggleActive(campaign)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg">
                  {campaign.is_active ? 'Pausar' : 'Activar'}
                </button>
                <button type="button" onClick={() => removeCampaign(campaign)} className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg">
                  Eliminar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

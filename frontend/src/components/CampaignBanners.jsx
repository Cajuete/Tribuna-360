import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AlertBanner from './AlertBanner';

const money = value => `Bs ${Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const THEMES = [
  { words: ['halloween', 'hallowen', 'noche de brujas', 'terror'], label: 'Especial de Halloween', background: 'from-orange-950 via-purple-950 to-slate-950', accent: 'text-orange-200' },
  { words: ['navidad', 'naviden', 'nochebuena'], label: 'Especial de Navidad', background: 'from-red-950 via-emerald-950 to-slate-950', accent: 'text-emerald-200' },
  { words: ['black friday', 'cyber monday'], label: 'Ofertas especiales', background: 'from-amber-950 via-slate-950 to-black', accent: 'text-amber-200' },
  { words: ['carnaval'], label: 'Especial de Carnaval', background: 'from-fuchsia-950 via-indigo-950 to-slate-950', accent: 'text-fuchsia-200' },
  { words: ['aniversario', 'cumpleanos'], label: 'Celebración especial', background: 'from-rose-950 via-violet-950 to-slate-950', accent: 'text-rose-200' },
  { words: ['verano'], label: 'Especial de Verano', background: 'from-cyan-950 via-blue-950 to-slate-950', accent: 'text-cyan-200' },
];

function getCampaignTheme(campaign) {
  const text = `${campaign.title || ''} ${campaign.description || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return THEMES.find(theme => theme.words.some(word => text.includes(word))) || {
    label: 'Promoción del club',
    background: 'from-emerald-950 via-slate-900 to-gray-950',
    accent: 'text-emerald-200',
  };
}

function offerLabel(offer) {
  if (offer.discount_type === 'percentage') return `${Number(offer.discount_value)}%`;
  const itemPrice = Number(offer.products?.price ?? offer.zones?.price ?? offer.membership_plans?.price);
  const discount = Number.isFinite(itemPrice)
    ? Math.min(Number(offer.discount_value), itemPrice)
    : Number(offer.discount_value);
  return `${money(discount)} de descuento`;
}

export default function CampaignBanners({ campaigns, placement, loading, error }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleCampaigns = campaigns.filter(campaign => !placement || campaign.placements?.includes(placement));

  useEffect(() => {
    setActiveIndex(0);
  }, [placement, visibleCampaigns.length]);

  useEffect(() => {
    if (visibleCampaigns.length < 2) return undefined;
    const timer = setInterval(() => {
      setActiveIndex(index => (index + 1) % visibleCampaigns.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [visibleCampaigns.length]);

  if (error) {
    return <AlertBanner message={error} type="error" className="mb-6" />;
  }
  if (loading || visibleCampaigns.length === 0) return null;
  const campaign = visibleCampaigns[activeIndex] || visibleCampaigns[0];
  const ticketOffer = placement === 'matches' ? campaign.campaign_ticket_offers?.[0] : null;
  const membershipOffer = placement === 'memberships' ? campaign.campaign_membership_offers?.[0] : null;
  const theme = getCampaignTheme(campaign);
  const href = membershipOffer
    ? '/socios'
    : ticketOffer
      ? `/comprar/${ticketOffer.match_id}`
      : placement === 'store'
        ? '/tienda'
        : campaign.tenants?.slug
          ? `/club/${campaign.tenants.slug}`
          : '/tienda';
  const offers = [
    ...(campaign.campaign_offers || []).map(offer => ({
      id: offer.id,
      label: `${offerLabel(offer)}${offer.products?.name ? ` en ${offer.products.name}` : ''}`,
    })),
    ...(campaign.campaign_ticket_offers || []).map(offer => ({
      id: offer.id,
      label: `${offerLabel(offer)} en ${offer.zones?.name || 'Entradas'}${offer.matches?.opponent ? ` · vs. ${offer.matches.opponent}` : ''}`,
    })),
    ...(campaign.campaign_membership_offers || []).map(offer => ({
      id: offer.id,
      label: `${offerLabel(offer)} en ${offer.membership_plans?.name || 'Plan de socio'}`,
    })),
  ];
  const visibleOffers = offers.slice(0, 2);
  const remainingOffers = offers.length - visibleOffers.length;

  return (
    <section className="max-w-6xl mx-auto px-6 mt-8 mb-8" aria-label="Promociones vigentes" aria-roledescription="carrusel">
      <article className="card relative overflow-hidden border border-emerald-500/25">
        <Link to={href} className="block group">
          <div className={`relative isolate flex min-h-[152px] items-center gap-3 overflow-hidden bg-gradient-to-br px-4 py-3 sm:min-h-[176px] sm:gap-5 sm:px-5 sm:py-4 ${theme.background}`}>
            {campaign.banner_image_url && (
              <>
                <img
                  src={campaign.banner_image_url}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full scale-105 object-cover opacity-60 blur-[1px]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
              </>
            )}
            <div className="relative z-10 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[0.65rem]">
                <span className={`badge ${theme.accent}`}>{theme.label}</span>
                {campaign.tenants?.name && <span className="text-emerald-200">{campaign.tenants.name}</span>}
                {visibleCampaigns.length > 1 && (
                  <span className="text-gray-300">{activeIndex + 1} / {visibleCampaigns.length}</span>
                )}
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold mt-1.5 line-clamp-2">{campaign.title}</h2>
              {campaign.description && <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-md line-clamp-2">{campaign.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {visibleOffers.map(offer => (
                  <span key={offer.id} title={offer.label} className="max-w-full truncate rounded-full bg-emerald-400/15 border border-emerald-300/30 px-2.5 py-1 text-[0.65rem] text-emerald-200">
                    {offer.label}
                  </span>
                ))}
                {remainingOffers > 0 && (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.65rem] text-gray-200">
                    +{remainingOffers} ofertas
                  </span>
                )}
              </div>
              <span className="inline-block mt-2 text-xs sm:text-sm font-bold text-lime-300 group-hover:text-lime-200">
                {membershipOffer ? 'Ver planes de socio →' : ticketOffer ? 'Comprar entradas →' : 'Ver ofertas →'}
              </span>
            </div>
            {campaign.banner_image_url && (
              <div className="relative z-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/20 sm:h-32 sm:w-32 md:h-40 md:w-40">
                <img
                  src={campaign.banner_image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full rounded-lg object-contain p-1.5"
                />
              </div>
            )}
          </div>
        </Link>
        {visibleCampaigns.length > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/10 px-3 py-1.5">
            <button
              type="button"
              aria-label="Promoción anterior"
              onClick={() => setActiveIndex(index => (index - 1 + visibleCampaigns.length) % visibleCampaigns.length)}
              className="rounded-full bg-black/30 p-1 text-white hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              {visibleCampaigns.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Mostrar promoción ${index + 1}`}
                  aria-current={index === activeIndex}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full ${index === activeIndex ? 'bg-emerald-300' : 'bg-white/50'}`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Siguiente promoción"
              onClick={() => setActiveIndex(index => (index + 1) % visibleCampaigns.length)}
              className="rounded-full bg-black/30 p-1 text-white hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </article>
    </section>
  );
}

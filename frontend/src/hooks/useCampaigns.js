import { useEffect, useMemo, useState } from 'react';
import { campaignService } from '../api/campaign.service';

export function useCampaigns({ placement, tenantId, enabled = true } = {}) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setCampaigns([]);
      setLoading(false);
      setError(null);
      return () => { active = false; };
    }

    setLoading(true);
    setError(null);
    const filters = { tenant_id: tenantId };
    campaignService.getPublic(filters)
      .then(response => {
        if (!active) return;
        if (!response.success) throw new Error(response.message || 'No se pudieron cargar las campañas.');
        setCampaigns(response.data || []);
      })
      .catch(loadError => {
        console.error('[Campaigns] No se pudieron cargar las campañas públicas:', loadError);
        if (active) setError('Las promociones no están disponibles en este momento.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [enabled, placement, tenantId]);

  const discountsByProduct = useMemo(() => {
    const discounts = {};
    for (const campaign of campaigns) {
      for (const offer of campaign.campaign_offers || []) {
        const product = offer.products;
        const price = Number(product?.price);
        if (!product?.id || product.tenant_id !== campaign.tenant_id || !Number.isFinite(price) || price < 0) continue;

        const rawDiscount = offer.discount_type === 'percentage'
          ? price * Number(offer.discount_value) / 100
          : Number(offer.discount_value);
        const discount = Math.round(Math.min(price, rawDiscount) * 100) / 100;
        const existing = discounts[product.id];
        if (!existing || discount > existing.discount) {
          discounts[product.id] = {
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            discount,
            originalPrice: price,
            finalPrice: Math.max(0, Math.round((price - discount) * 100) / 100),
          };
        }
      }
    }
    return discounts;
  }, [campaigns]);

  const discountsByPlan = useMemo(() => {
    const discounts = {};
    for (const campaign of campaigns) {
      for (const offer of campaign.campaign_membership_offers || []) {
        const plan = offer.membership_plans;
        const price = Number(plan?.price);
        if (!plan?.id || plan.tenant_id !== campaign.tenant_id || !Number.isFinite(price) || price <= 0) continue;

        const rawDiscount = offer.discount_type === 'percentage'
          ? price * Number(offer.discount_value) / 100
          : Number(offer.discount_value);
        const discount = Math.round(Math.min(price - 0.01, rawDiscount) * 100) / 100;
        const existing = discounts[plan.id];
        if (discount > 0 && (!existing || discount > existing.discount)) {
          discounts[plan.id] = {
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            discount,
            originalPrice: price,
            finalPrice: Math.max(0.01, Math.round((price - discount) * 100) / 100),
          };
        }
      }
    }
    return discounts;
  }, [campaigns]);

  return { campaigns, discountsByProduct, discountsByPlan, loading, error };
}

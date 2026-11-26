export function getPromotionDiscount(subtotal, promotion) {
  const amount = Number(subtotal);
  const value = Number(promotion?.discount_value);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(value) || value <= 0) return 0;

  const discount = promotion.discount_type === 'percentage'
    ? amount * value / 100
    : Math.min(amount, value);

  return Math.round(Math.min(amount, discount) * 100) / 100;
}

export const isValidBolivianPhone = value => /^[567]\d{7}$/.test(value);
export const isValidBolivianCi = value => /^\d{6,8}$/.test(value);

export const normalizeBolivianPhoneInput = value => {
  const digits = String(value ?? '').replace(/\D/g, '');
  const localDigits = digits.length === 11 && digits.startsWith('591')
    ? digits.slice(3)
    : digits;
  return localDigits.slice(0, 8);
};

export const formatBolivianPhoneForInput = value => {
  const phone = String(value ?? '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('591')) return digits.slice(3);
  return digits.length === 8 ? digits : phone;
};

export const normalizeBolivianCiInput = value => String(value ?? '').replace(/\D/g, '').slice(0, 8);

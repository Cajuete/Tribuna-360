const BOLIVIAN_PHONE_RE = /^[567]\d{7}$/;
const BOLIVIAN_CI_RE = /^\d{6,8}$/;

module.exports = {
    isValidBolivianPhone: value => BOLIVIAN_PHONE_RE.test(value),
    isValidBolivianCi: value => BOLIVIAN_CI_RE.test(value),
};

import AlertBanner from '../components/AlertBanner';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { paymentService } from '../api/payment.service';
import { promotionService } from '../api/promotion.service';
import { tenantService } from '../api/tenant.service';
import { DELIVERY_DEPARTMENTS } from '../config/delivery';
import { useAuth } from '../context/auth-context';
import { formatBolivianPhoneForInput, normalizeBolivianPhoneInput } from '../utils/bolivian-validation';
import { useCart } from '../context/cart-context';
import { useCampaigns } from '../hooks/useCampaigns';
import { getPromotionDiscount } from '../utils/promotion-code';

export default function Cart() {
  const { user, token } = useAuth();
  const { cart, setCart } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState(null);
  const [validatingPromotion, setValidatingPromotion] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [deliverySettingsError, setDeliverySettingsError] = useState(null);
  const [loadingDeliverySettings, setLoadingDeliverySettings] = useState(false);
  const [delivery, setDelivery] = useState({
    recipientName: null,
    phone: null,
    method: 'home',
    city: '',
    department: '',
    zone: '',
    street: '',
    number: '',
    location: '',
    reference: '',
  });

  const tenantId = cart[0]?.product.tenant_id;
  const { discountsByProduct } = useCampaigns({
    placement: 'store',
    tenantId,
    enabled: Boolean(tenantId),
  });
  const regularCartPrice = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => {
    const price = discountsByProduct[item.product.id]?.finalPrice ?? Number(item.product.price);
    return sum + price * item.quantity;
  }, 0);
  const campaignSavings = Math.max(0, regularCartPrice - totalCartPrice);
  const codeDiscount = getPromotionDiscount(totalCartPrice, appliedPromotion);
  const totalWithPromotion = Math.max(0, totalCartPrice - codeDiscount);

  useEffect(() => {
    if (!tenantId) {
      setDeliverySettings(null);
      setDeliverySettingsError(null);
      return undefined;
    }

    let active = true;
    setDeliverySettings(null);
    setLoadingDeliverySettings(true);
    setDeliverySettingsError(null);
    tenantService.getDeliverySettings(tenantId)
      .then(response => {
        if (active) setDeliverySettings(response.data);
      })
      .catch(err => {
        if (active) setDeliverySettingsError(err.message);
      })
      .finally(() => {
        if (active) setLoadingDeliverySettings(false);
      });

    return () => { active = false; };
  }, [tenantId]);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const originDepartment = deliverySettings?.department;
  const deliverySettingsReady = DELIVERY_DEPARTMENTS.includes(originDepartment);
  const baseDeliveryFee = delivery.method === 'home'
    ? Number(deliverySettings?.delivery_home_fee)
    : Number(deliverySettings?.delivery_point_fee);
  const interdepartmentFee = delivery.department && delivery.department !== originDepartment
    ? Number(deliverySettings?.delivery_interdepartment_surcharge)
    : 0;
  const deliveryFee = deliverySettingsReady && delivery.department && Number.isFinite(baseDeliveryFee + interdepartmentFee)
    ? baseDeliveryFee + interdepartmentFee
    : null;
  const deliveryFeeLabel = deliveryFee !== null
    ? `Bs ${deliveryFee.toLocaleString('es-BO')}`
    : deliverySettingsError
      ? 'No disponible'
      : !delivery.department
        ? 'Selecciona el departamento'
        : loadingDeliverySettings
          ? 'Cargando...'
          : 'No disponible';
  const deliveryAddress = delivery.method === 'home'
    ? [
        delivery.street.trim(),
        delivery.number.trim() && `N.º ${delivery.number.trim()}`,
        delivery.zone.trim(),
        delivery.city.trim(),
        delivery.department,
    ].filter(Boolean).join(', ')
    : [delivery.location.trim(), delivery.city.trim(), delivery.department].filter(Boolean).join(', ');
  const recipientName = (delivery.recipientName ?? user?.full_name ?? '').trim();
  const recipientPhone = (delivery.phone ?? formatBolivianPhoneForInput(user?.phone)).trim();

  const updateCartQty = (productId, delta) => {
    setError(null);
    setAppliedPromotion(null);
    setPromotionMessage(null);
    const item = cart.find(cartItem => cartItem.product.id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }
    if (newQty > item.product.stock) {
      setError(`Stock máximo alcanzado para "${item.product.name}" (${item.product.stock} disponibles).`);
      return;
    }
    setCart(cart.map(cartItem => cartItem.product.id === productId
      ? { ...cartItem, quantity: newQty }
      : cartItem));
  };

  const removeFromCart = (productId) => {
    setAppliedPromotion(null);
    setPromotionMessage(null);
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const handleApplyPromotion = async () => {
    if (!promotionCode.trim()) {
      setPromotionMessage({ ok: false, text: 'Escribe el código que te compartieron.' });
      setAppliedPromotion(null);
      return;
    }
    setValidatingPromotion(true);
    setPromotionMessage(null);
    try {
      const response = await promotionService.validateCode({
        code: promotionCode,
        purchase_type: 'store',
        items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
      });
      if (getPromotionDiscount(totalCartPrice, response.data) >= totalCartPrice) {
        setAppliedPromotion(null);
        setPromotionMessage({ ok: false, text: 'El descuento no puede dejar el pago en cero. Usa un código de menor valor.' });
        return;
      }
      setAppliedPromotion(response.data);
      setPromotionCode(response.data.code);
      setPromotionMessage({ ok: true, text: 'Código válido. El descuento se aplicará a esta compra.' });
    } catch (validationError) {
      setAppliedPromotion(null);
      setPromotionMessage({ ok: false, text: validationError.message });
    } finally {
      setValidatingPromotion(false);
    }
  };

  const handleCheckout = async (event) => {
    event.preventDefault();
    if (!token || cart.length === 0) return;
    if (appliedPromotion && totalWithPromotion <= 0) {
      setError('El descuento no puede dejar el pago en cero. Usa un código de menor valor.');
      return;
    }
    if (promotionCode.trim() && !appliedPromotion) {
      setError('Aplica primero el código promocional o bórralo para continuar.');
      return;
    }
    setCheckingOut(true);
    setError(null);
    try {
      const res = await paymentService.create('store', {
        items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
        promo_code: appliedPromotion?.code,
        delivery: {
          recipient_name: (delivery.recipientName ?? user?.full_name ?? '').trim(),
          phone: (delivery.phone ?? formatBolivianPhoneForInput(user?.phone)).trim(),
          method: delivery.method,
          city: delivery.city.trim(),
          department: delivery.department,
          zone: delivery.method === 'home' ? delivery.zone.trim() : '',
          street: delivery.method === 'home' ? delivery.street.trim() : '',
          number: delivery.method === 'home' ? delivery.number.trim() : '',
          location: delivery.method === 'point' ? delivery.location.trim() : '',
          reference: delivery.reference.trim(),
        },
      });
      setCart([]);
      navigate(`/pagar/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="eyebrow">Tienda del Club</span>
          <h2 className="section-title text-3xl mt-1">Tu Carrito</h2>
        </div>
        <Link to="/tienda" className="btn btn-outline py-2.5 px-5">
          Seguir comprando
        </Link>
      </div>

      <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mb-6" />

      {!token ? (
        <div className="card p-8 text-center border border-slate-700">
          <ShoppingCart className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-300">
            <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link>
            {' '}para armar tu carrito y comprar productos.
          </p>
        </div>
      ) : cart.length === 0 ? (
        <p className="card p-8 text-sm text-gray-400 text-center border border-slate-700">
          El carrito está vacío. Agrega productos de la tienda.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form id="cart-checkout-form" onSubmit={handleCheckout} className="card min-w-0 p-5 border border-slate-700">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  Productos seleccionados
                </h3>
                <span className="text-xs text-slate-400">{totalCartItems} artículo(s)</span>
              </div>

              <div className="divide-y divide-slate-800">
                {cart.map(item => (
                  <div key={item.product.id} className="py-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-white">{item.product.name}</p>
                      <p className="text-xs text-emerald-400 font-semibold">
                        {discountsByProduct[item.product.id] && (
                          <span className="text-gray-500 line-through mr-1">Bs {Number(item.product.price).toLocaleString('es-BO')}</span>
                        )}
                        Bs {Number(discountsByProduct[item.product.id]?.finalPrice ?? item.product.price).toLocaleString('es-BO')} c/u
                      </p>
                      {discountsByProduct[item.product.id] && (
                        <p className="text-[11px] text-lime-300">{discountsByProduct[item.product.id].campaignTitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, -1)}
                        aria-label={`Disminuir cantidad de ${item.product.name}`}
                        className="w-8 h-8 bg-slate-900 border border-slate-700 rounded-md flex items-center justify-center hover:bg-slate-800"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, 1)}
                        aria-label={`Aumentar cantidad de ${item.product.name}`}
                        className="w-8 h-8 bg-slate-900 border border-slate-700 rounded-md flex items-center justify-center hover:bg-slate-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        aria-label={`Quitar ${item.product.name} del carrito`}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-800 pt-5 mt-2">
                <h3 className="text-lg font-bold mb-1">Datos para la entrega</h3>
                <p className="text-xs text-slate-400 mb-4">
                  No usamos mapa. Escribe la dirección o el punto acordado para que el club pueda coordinar el envío.
                </p>
                {loadingDeliverySettings && <p className="text-xs text-slate-400 mb-3">Cargando tarifas de entrega...</p>}
                {deliverySettingsError && <p className="text-xs text-red-300 mb-3">{deliverySettingsError}</p>}
                {!loadingDeliverySettings && !deliverySettingsError && !deliverySettingsReady && (
                  <p className="text-xs text-amber-200 mb-3">El club debe configurar su departamento de origen antes de aceptar pedidos.</p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block text-sm text-slate-300">
                    Nombre de quien recibe
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      autoComplete="name"
                      value={delivery.recipientName ?? user?.full_name ?? ''}
                      onChange={event => setDelivery(current => ({ ...current, recipientName: event.target.value }))}
                      className="input mt-2"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Teléfono de contacto
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      minLength={8}
                      maxLength={8}
                      pattern="[567][0-9]{7}"
                      title="Ingresa 8 dígitos y comienza con 5, 6 o 7."
                      autoComplete="tel-national"
                      value={delivery.phone ?? formatBolivianPhoneForInput(user?.phone)}
                      onChange={event => setDelivery(current => ({ ...current, phone: normalizeBolivianPhoneInput(event.target.value) }))}
                      className="input mt-2"
                    />
                    <span className="mt-1 block text-xs text-slate-400">8 dígitos; debe comenzar con 5, 6 o 7.</span>
                  </label>
                  <label className="block text-sm text-slate-300 sm:col-span-2">
                    Tipo de entrega
                    <select
                      value={delivery.method}
                      onChange={event => setDelivery(current => ({ ...current, method: event.target.value }))}
                      className="input mt-2"
                    >
                      <option value="home">A domicilio</option>
                      <option value="point">Punto de entrega acordado</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    Ciudad o municipio
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="address-level2"
                      value={delivery.city}
                      onChange={event => setDelivery(current => ({ ...current, city: event.target.value }))}
                      className="input mt-2"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Departamento de entrega
                    <select
                      required
                      value={delivery.department}
                      onChange={event => setDelivery(current => ({ ...current, department: event.target.value }))}
                      className="input mt-2"
                    >
                      <option value="">Selecciona un departamento</option>
                      {DELIVERY_DEPARTMENTS.map(department => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </label>
                  {delivery.method === 'home' ? (
                    <>
                      <label className="block text-sm text-slate-300">
                        Zona o barrio
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={100}
                          autoComplete="address-level3"
                          value={delivery.zone}
                          onChange={event => setDelivery(current => ({ ...current, zone: event.target.value }))}
                          className="input mt-2"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Calle o avenida
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={160}
                          autoComplete="street-address"
                          value={delivery.street}
                          onChange={event => setDelivery(current => ({ ...current, street: event.target.value }))}
                          className="input mt-2"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        Número de domicilio (opcional)
                        <input
                          type="text"
                          maxLength={30}
                          value={delivery.number}
                          onChange={event => setDelivery(current => ({ ...current, number: event.target.value }))}
                          className="input mt-2"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="block text-sm text-slate-300 sm:col-span-2">
                      Lugar o punto de entrega
                      <textarea
                        required
                        minLength={5}
                        maxLength={240}
                        rows={2}
                        placeholder="Describe el lugar acordado; por ejemplo, una plaza, portería o punto conocido."
                        value={delivery.location}
                        onChange={event => setDelivery(current => ({ ...current, location: event.target.value }))}
                        className="input mt-2"
                      />
                    </label>
                  )}
                  <label className="block text-sm text-slate-300 sm:col-span-2">
                    Referencia adicional (opcional)
                    <input
                      type="text"
                      maxLength={250}
                      value={delivery.reference}
                      onChange={event => setDelivery(current => ({ ...current, reference: event.target.value }))}
                      className="input mt-2"
                    />
                  </label>
                </div>
              </div>
            </div>
          </form>

          <aside className="card self-start border border-slate-700 p-5 lg:sticky lg:top-24">
              <h3 className="text-lg font-bold text-white">Resumen de compra</h3>
              <p className="text-xs text-slate-400 mt-1">{totalCartItems} artículo(s)</p>

              <ul className="mt-4 space-y-3">
                {cart.map(item => (
                  <li key={item.product.id} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 text-slate-300">
                      <span className="block truncate">{item.product.name}</span>
                      <span className="text-xs text-slate-500">
                        {item.quantity} × Bs {Number(discountsByProduct[item.product.id]?.finalPrice ?? item.product.price).toLocaleString('es-BO')}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-200">
                      Bs {((discountsByProduct[item.product.id]?.finalPrice ?? Number(item.product.price)) * item.quantity).toLocaleString('es-BO')}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-2">
                <label htmlFor="cart-promo-code" className="block text-sm font-semibold text-slate-300">
                  ¿Tienes un código promocional?
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-promo-code"
                    value={promotionCode}
                    onChange={event => {
                      setPromotionCode(event.target.value.toUpperCase());
                      setAppliedPromotion(null);
                      setPromotionMessage(null);
                    }}
                    maxLength={50}
                    placeholder="Ej. HINCHA10"
                    className="input min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromotion}
                    disabled={validatingPromotion || cart.length === 0}
                    className="shrink-0 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
                  >
                    {validatingPromotion ? 'Validando...' : 'Aplicar'}
                  </button>
                </div>
                {promotionMessage && (
                  <p className={`text-xs ${promotionMessage.ok ? 'text-emerald-300' : 'text-rose-300'}`} role="status">
                    {promotionMessage.text}
                  </p>
                )}
              </div>

              <div className="mt-4 border-t border-slate-700 pt-4 space-y-3 text-sm">
                {campaignSavings > 0 && (
                  <div className="flex justify-between gap-3 text-emerald-300">
                    <span>Descuento de campaña</span>
                    <span>− Bs {campaignSavings.toLocaleString('es-BO')}</span>
                  </div>
                )}
                {appliedPromotion && (
                  <div className="flex justify-between gap-3 text-emerald-300">
                    <span>Código {appliedPromotion.code}</span>
                    <span>− Bs {codeDiscount.toLocaleString('es-BO')}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3 text-slate-300">
                  <span>Productos</span>
                  <span>Bs {totalWithPromotion.toLocaleString('es-BO')}</span>
                </div>
                {appliedPromotion && totalWithPromotion <= 0 && (
                  <p className="text-xs text-amber-300">El descuento no puede dejar el pago en cero. Usa un código de menor valor.</p>
                )}

                <div className="space-y-2">
                  <p className="text-slate-300">
                    Envío {delivery.method === 'home' ? 'a domicilio' : 'a punto acordado'}
                    {delivery.department ? ` · ${delivery.department}` : ''}
                  </p>
                  {deliveryFee === null ? (
                    <p className="text-xs text-amber-200">{deliveryFeeLabel}</p>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3 text-xs text-slate-400">
                        <span>Tarifa base</span>
                        <span>Bs {baseDeliveryFee.toLocaleString('es-BO')}</span>
                      </div>
                      {interdepartmentFee > 0 && (
                        <div className="flex justify-between gap-3 text-xs text-slate-400">
                          <span>Recargo interdepartamental</span>
                          <span>Bs {interdepartmentFee.toLocaleString('es-BO')}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 text-slate-300">
                        <span>Total envío</span>
                        <span>Bs {deliveryFee.toLocaleString('es-BO')}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-slate-700 pt-3 flex justify-between gap-3 font-bold text-emerald-300">
                  <span>Total con envío</span>
                  <span>{deliveryFee === null ? '—' : `Bs ${(totalWithPromotion + deliveryFee).toLocaleString('es-BO')}`}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-slate-800/70 p-3 text-xs text-slate-400">
                <p className="font-semibold text-slate-300">Entrega</p>
                <p className="mt-1">{recipientName || 'Nombre de quien recibe'}</p>
                <p>{recipientPhone || 'Teléfono de contacto'}</p>
                <p className="mt-1">{deliveryAddress || 'Completa la ubicación de entrega'}</p>
              </div>

              <button
                type="submit"
                form="cart-checkout-form"
                disabled={checkingOut || loadingDeliverySettings || !deliverySettingsReady || !delivery.department || deliveryFee === null || (appliedPromotion && totalWithPromotion <= 0)}
                className="btn btn-primary w-full py-3 mt-5 font-bold"
              >
                {checkingOut ? 'Preparando compra...' : 'Continuar al pago QR'}
              </button>
          </aside>
        </div>
      )}
    </div>
  );
}

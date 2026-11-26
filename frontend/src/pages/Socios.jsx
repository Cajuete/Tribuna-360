import AlertBanner from '../components/AlertBanner';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { membershipService } from '../api/membership.service';
import { paymentService } from '../api/payment.service';
import { useAuth } from '../context/auth-context';
import CampaignBanners from '../components/CampaignBanners';
import { useCampaigns } from '../hooks/useCampaigns';

export default function Socios() {
  const { token, user } = useAuth();
  const canShop = !token || user?.role === 'fan';
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribing, setSubscribing] = useState(null);
  const { campaigns, discountsByPlan, loading: campaignsLoading, error: campaignsError } = useCampaigns({ placement: 'memberships' });

  useEffect(() => {
    membershipService.getPlans()
      .then(res => { if (res.status === 'success') setPlans(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan) => {
    if (!token || user?.role !== 'fan') return;
    setSubscribing(plan.id);
    setError(null);
    try {
      const res = await paymentService.create('membership', { plan_id: plan.id });
      if (res.success) navigate(`/pagar/${res.data.id}`);
    } catch (err) {
      setError(err.message);
      setSubscribing(null);
    }
  };

  const grouped = plans.reduce((acc, p) => {
    const key = p.tenants?.name || 'Club';
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  if (loading) return <p className="text-center text-gray-400 py-16">Cargando planes de socio...</p>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <span className="eyebrow">Membresías</span>
      <h2 className="section-title text-3xl mt-1 mb-2">Hazte Socio</h2>
      <p className="text-gray-400 text-sm mb-8">El club confirmará tu pago antes de activar la membresía.</p>

      <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mb-4" />
      <CampaignBanners campaigns={campaigns} placement="memberships" loading={campaignsLoading} error={campaignsError} />

      {Object.entries(grouped).map(([club, clubPlans]) => (
        <div key={club} className="mb-10">
          <h3 className="font-display text-xl font-bold text-emerald-400 mb-4">{club}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clubPlans.map(plan => {
              const discount = discountsByPlan[plan.id];
              return (
                <div key={plan.id} className="card card-hover p-6 flex flex-col">
                  <h4 className="text-lg font-bold">{plan.name}</h4>
                  {discount && <p className="text-xs text-gray-400 line-through mt-2">Bs {Number(plan.price).toLocaleString('es-BO')}</p>}
                  <p className="text-emerald-400 font-bold text-2xl mt-2">
                    Bs {Number(discount?.finalPrice ?? plan.price).toLocaleString('es-BO')}<span className="text-sm text-gray-400 font-normal">/{plan.duration_days || 30} días</span>
                  </p>
                  {discount && <p className="text-xs text-lime-300 mt-1">Oferta: {discount.campaignTitle} · ahorras Bs {discount.discount.toLocaleString('es-BO')}</p>}
                  <p className="text-sm text-gray-300 mt-3 flex-1">{plan.benefits}</p>
                  {canShop && (
                    <button
                      type="button"
                      disabled={!token || subscribing === plan.id}
                      onClick={() => handleSubscribe(plan)}
                      className="btn btn-primary mt-5 w-full py-2.5"
                    >
                      {subscribing === plan.id ? 'Procesando...' : token ? 'Asociarme' : 'Inicia sesión'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!token && (
        <p className="p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para asociarte a un club.
        </p>
      )}
      {token && !canShop && (
        <p className="p-4 rounded-xl border border-amber-700/50 bg-amber-950/30 text-center text-amber-200">
          Esta cuenta es de personal del club. Para asociarte, ingresa con una cuenta de hincha.
        </p>
      )}
    </div>
  );
}

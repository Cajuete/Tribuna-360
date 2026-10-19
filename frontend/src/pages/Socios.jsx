import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { membershipService } from '../api/membership.service';
import { useAuth } from '../context/auth-context';

export default function Socios() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subscribing, setSubscribing] = useState(null);

  useEffect(() => {
    membershipService.getPlans()
      .then(res => { if (res.status === 'success') setPlans(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan) => {
    if (!token) return;
    setSubscribing(plan.id);
    setError(null);
    try {
      const res = await membershipService.subscribe(plan.id);
      if (res.status === 'success') navigate('/mis-socio', { state: { message: res.message } });
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
      <p className="text-gray-400 text-sm mb-8">Membresías con beneficios en entradas y tienda (pago simulado).</p>

      {error && <p className="mb-4 alert-error">{error}</p>}

      {Object.entries(grouped).map(([club, clubPlans]) => (
        <div key={club} className="mb-10">
          <h3 className="font-display text-xl font-bold text-emerald-400 mb-4">{club}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clubPlans.map(plan => (
              <div key={plan.id} className="card card-hover p-6 flex flex-col">
                <h4 className="text-lg font-bold">{plan.name}</h4>
                <p className="text-emerald-400 font-bold text-2xl mt-2">
                  Bs {plan.price}<span className="text-sm text-gray-400 font-normal">/mes</span>
                </p>
                <p className="text-sm text-gray-300 mt-3 flex-1">{plan.benefits}</p>
                <button
                  type="button"
                  disabled={!token || subscribing === plan.id}
                  onClick={() => handleSubscribe(plan)}
                  className="btn btn-primary mt-5 w-full py-2.5"
                >
                  {subscribing === plan.id ? 'Procesando...' : token ? 'Asociarme' : 'Inicia sesión'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!token && (
        <p className="p-4 rounded-xl glass border border-white/10 text-center text-gray-300">
          <Link to="/login" className="text-emerald-400 font-semibold underline">Inicia sesión</Link> para asociarte a un club.
        </p>
      )}
    </div>
  );
}

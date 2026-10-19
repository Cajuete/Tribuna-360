import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { membershipService } from '../api/membership.service';

export default function MyMembership() {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const location = useLocation();
  const message = location.state?.message;

  const load = () => {
    membershipService.getMine()
      .then(res => { if (res.status === 'success') setMemberships(res.data); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCancel = async (id) => {
    setCancelling(id);
    setError(null);
    try {
      const res = await membershipService.cancel(id);
      if (res.status === 'success') load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Mi Membresía</h2>

      {message && <p className="mb-6 p-3 rounded text-center bg-emerald-900 text-emerald-300">{message}</p>}
      {loading && <p className="text-center text-gray-400 py-8">Cargando membresías...</p>}
      {error && <p className="p-3 rounded text-center bg-red-900 text-red-300">{error}</p>}

      {!loading && !error && memberships.length === 0 && (
        <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
          <p className="text-gray-400 mb-4">Todavía no eres socio de ningún club.</p>
          <Link to="/socios" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg transition">
            Ver planes de socio
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {memberships.map(m => (
          <div key={m.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{m.tenants?.name}</p>
              <h3 className="font-bold text-lg">{m.membership_plans?.name}</h3>
              <p className="text-sm text-gray-300 mt-1">{m.membership_plans?.benefits}</p>
              <p className="text-emerald-400 font-semibold mt-1">Bs {m.membership_plans?.price}/mes</p>
              <p className="text-xs text-gray-500 mt-1">Desde {new Date(m.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-xs px-3 py-1 rounded-full uppercase font-semibold ${
                m.status === 'active' ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-700 text-gray-300'
              }`}>
                {m.status === 'active' ? 'Activa' : 'Cancelada'}
              </span>
              {m.status === 'active' && (
                <button
                  type="button"
                  disabled={cancelling === m.id}
                  onClick={() => handleCancel(m.id)}
                  className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                >
                  {cancelling === m.id ? 'Cancelando...' : 'Cancelar membresía'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

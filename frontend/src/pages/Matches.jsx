import AlertBanner from '../components/AlertBanner';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { matchService } from '../api/match.service';
import { tenantService } from '../api/tenant.service';
import { useAuth } from '../context/auth-context';
import CampaignBanners from '../components/CampaignBanners';
import { useCampaigns } from '../hooks/useCampaigns';

export default function Matches() {
  const { slug } = useParams();
  return <MatchesList key={slug || 'all'} slug={slug} />;
}

function MatchesList({ slug }) {
  const { token, user } = useAuth();
  const canShop = !token || user?.role === 'fan';
  const [tenant, setTenant] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { campaigns, loading: campaignsLoading, error: campaignsError } = useCampaigns({
    placement: 'matches',
  });

  useEffect(() => {
    let active = true;

    const loadMatches = async () => {
      try {
        let tenantId;
        if (slug) {
          const tenantResponse = await tenantService.getBySlug(slug);
          if (!tenantResponse.data) {
            throw new Error('No se pudo encontrar este club.');
          }
          tenantId = tenantResponse.data.id;
          if (active) setTenant(tenantResponse.data);
        }

        const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
        const response = await matchService.getAllMatches(query);
        if (response.status !== 'success') {
          throw new Error(response.message || 'No se pudieron cargar los partidos.');
        }
        if (active) setMatches(response.data);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMatches();
    return () => {
      active = false;
    };
  }, [slug]);

  const returnTo = slug ? `/club/${slug}` : '/';

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="eyebrow">Calendario</span>
          <h1 className="section-title text-3xl md:text-4xl mt-1">
            {tenant ? `Partidos de ${tenant.name}` : slug ? 'Partidos del club' : 'Todos los partidos'}
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            {slug ? 'Calendario completo de este club.' : 'Calendario de partidos publicados por todos los clubes.'}
          </p>
        </div>
        <Link to={returnTo} className="btn btn-outline py-2.5 px-5">
          {slug ? 'Volver al club' : 'Volver al inicio'}
        </Link>
      </div>

      <AlertBanner message={error} type="error" onClose={() => setError(null)} className="mb-6" />
      <CampaignBanners campaigns={campaigns} placement="matches" loading={campaignsLoading} error={campaignsError} />

      {loading ? (
        <p className="text-center text-gray-400 py-12">Cargando partidos...</p>
      ) : error ? null : matches.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {tenant ? 'Este club aún no tiene partidos publicados.' : 'Aún no hay partidos publicados. ¡Vuelve pronto!'}
        </div>
      ) : (
        <>
          {!canShop && (
            <p className="mb-5 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-sm text-amber-200">
              Esta cuenta es de personal del club. Para comprar entradas, ingresa con una cuenta de hincha.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {matches.map(match => (
              <article key={match.id} className="card card-hover overflow-hidden flex flex-col">
              <div className="relative h-36 overflow-hidden bg-slate-950">
                {match.image_url ? (
                  <img
                    src={match.image_url}
                    alt={`Partido contra ${match.opponent}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                    {match.tenants?.name || tenant?.name || 'Partido'}
                  </div>
                )}
                <span className="badge absolute top-3 left-3 bg-black/60">{match.status}</span>
                {!tenant && match.tenants?.name && (
                  <span className="absolute top-3 right-3 text-[0.65rem] font-bold uppercase tracking-widest text-lime-300 bg-black/60 border border-lime-400/40 rounded-full px-2.5 py-1">
                    {match.tenants.name}
                  </span>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="font-display text-xl font-bold text-white">{match.opponent}</h2>
                {(match.competition || match.matchday) && (
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-emerald-400 mt-1">
                    {[match.competition, match.matchday ? `Jornada ${match.matchday}` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-sm text-gray-400 mt-1">{match.stadium_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(match.match_date).toLocaleString()}
                </p>
                {canShop && (
                  <Link to={`/comprar/${match.id}`} className="btn btn-primary mt-5 w-full">
                    Comprar entradas
                  </Link>
                )}
              </div>
            </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

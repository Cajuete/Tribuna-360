import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { sponsorService } from '../api/sponsor.service';

export default function SponsorStrip({ tenantId }) {
  const [sponsors, setSponsors] = useState([]);
  const [error, setError] = useState(null);
  const sponsorsTrackRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!tenantId) {
      setSponsors([]);
      setError(null);
      return () => { active = false; };
    }

    sponsorService.getPublic(`?tenant_id=${encodeURIComponent(tenantId)}`)
      .then(response => {
        if (active && response.success) setSponsors(response.data || []);
      })
      .catch(loadError => {
        if (active) setError(loadError.message);
      });

    return () => { active = false; };
  }, [tenantId]);

  if (error) return <AlertBanner message={error} type="error" className="mt-6" />;
  if (sponsors.length === 0) return null;

  return (
    <section className="mt-8" aria-label="Patrocinadores oficiales del club">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="eyebrow">Patrocinadores oficiales</h2>
        {sponsors.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-gray-500 sm:inline">Desliza para ver más</span>
            <button
              type="button"
              onClick={() => sponsorsTrackRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
              aria-label="Ver patrocinadores anteriores"
              className="rounded-full border border-slate-700 bg-slate-900 p-2 text-gray-300 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => sponsorsTrackRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
              aria-label="Ver más patrocinadores"
              className="rounded-full border border-slate-700 bg-slate-900 p-2 text-gray-300 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={sponsorsTrackRef}
        tabIndex={0}
        aria-label="Logos de patrocinadores"
        className="overflow-x-auto scroll-smooth snap-x snap-mandatory focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        <div className="flex w-max min-w-full items-center justify-center gap-4 py-1">
        {sponsors.map(sponsor => {
          const content = (
            sponsor.logo_url
              ? <img src={sponsor.logo_url} alt={sponsor.name} loading="lazy" className="h-full w-full object-contain" />
              : <span className="font-semibold text-slate-800">{sponsor.name}</span>
          );
          return sponsor.link ? (
            <a key={sponsor.id} href={sponsor.link} target="_blank" rel="noopener noreferrer" aria-label={sponsor.name} className="flex h-24 w-48 shrink-0 snap-center items-center justify-center rounded-xl border border-white/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:h-28 sm:w-56">
              {content}
            </a>
          ) : (
            <div key={sponsor.id} className="flex h-24 w-48 shrink-0 snap-center items-center justify-center rounded-xl border border-white/80 bg-white p-4 shadow-sm sm:h-28 sm:w-56">
              {content}
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}

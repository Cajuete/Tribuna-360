import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { matchService } from '../api/match.service';
import { tenantService } from '../api/tenant.service';
import { associationService } from '../api/association.service';
import ClubLogo from '../components/ClubLogo';
import hero1 from '../assets/images (1).jpg';
import hero2 from '../assets/images (3).jpg';
import hero3 from '../assets/images (5).jpg';
import imgSquare from '../assets/images (2).jpg';
import imgSmall from '../assets/images.jpg';
import imgTiny from '../assets/images (4).jpg';
import heroPng from '../assets/hero.png';

const SLIDES = [
  {
    img: hero1,
    eyebrow: 'Entradas digitales',
    title: 'Tu lugar en la grada, en segundos',
    text: 'Compra con QR, prescinde de filas y vive cada partido desde la tribuna de tu club.',
    to: '/',
    cta: 'Ver partidos',
    alt: 'Estadio de fútbol lleno',
  },
  {
    img: hero2,
    eyebrow: 'Tienda oficial',
    title: 'Viste los colores de tu club',
    text: 'Camisetas, bufandas y merchandising oficial de cada club de la plataforma.',
    to: '/tienda',
    cta: 'Ir a la tienda',
    alt: 'Merchandising deportivo',
  },
  {
    img: hero3,
    eyebrow: 'Socios del club',
    title: 'Más que un hincha, hazte parte',
    text: 'Planes de membresía con beneficios en entradas, tienda y experiencias del club.',
    to: '/socios',
    cta: 'Ver planes',
    alt: 'Hinchas en la tribuna',
  },
];

const CARD_IMGS = [hero1, hero2, hero3];

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    matchService
      .getAllMatches()
      .then(res => {
        if (res.status === 'success') setMatches(res.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    Promise.allSettled([
      tenantService.getAll(),
      associationService.getAll(),
    ]).then(([t, a]) => {
      const okTenants = t.status === 'fulfilled' && t.value.status === 'success';
      const clubsCount = okTenants ? t.value.data.length : null;
      const assocs = a.status === 'fulfilled' && a.value.status === 'success' ? a.value.data.length : null;
      if (okTenants) setClubs(t.value.data);
      if (clubsCount !== null || assocs !== null) setStats({ clubs: clubsCount, assocs });
    });
  }, []);

  const go = useCallback(
    dir => setSlide(s => (s + dir + SLIDES.length) % SLIDES.length),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => go(1), 6000);
    return () => clearInterval(timer);
  }, [go]);

  const s = SLIDES[slide];

  return (
    <div>
      <section className="relative max-w-7xl mx-auto px-4 mt-5">
        <div className="relative h-[440px] md:h-[540px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          {SLIDES.map((sl, i) => (
            <div
              key={sl.title}
              className={`absolute inset-0 transition-opacity duration-700 ${i === slide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <img src={sl.img} alt={sl.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
          ))}

          <div className="relative h-full flex items-center">
            <div className="px-8 md:px-14 max-w-2xl">
              <span className="badge mb-4">{s.eyebrow}</span>
              <h1 className="section-title text-4xl md:text-6xl mb-4">{s.title}</h1>
              <p className="text-gray-300 md:text-lg mb-7 max-w-lg">{s.text}</p>
              <div className="flex flex-wrap gap-3">
                <Link to={s.to} className="btn btn-primary">
                  {s.cta}
                </Link>
                <Link to="/unete" className="btn btn-outline">
                  Únete a tu club
                </Link>
              </div>
            </div>
          </div>

          <button
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass border border-white/15 text-white text-xl hover:bg-emerald-600/80 transition"
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full glass border border-white/15 text-white text-xl hover:bg-emerald-600/80 transition"
          >
            ›
          </button>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2.5">
            {SLIDES.map((sl, i) => (
              <button
                key={sl.title}
                onClick={() => setSlide(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === slide ? 'w-8 bg-gradient-to-r from-emerald-400 to-lime-400' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </section>
      {stats && (
        <section className="max-w-5xl mx-auto px-6 mt-10">
          <div className="card grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5 overflow-hidden">
            {[
              { n: stats.clubs, l: 'Clubes en la plataforma' },
              { n: matches.length || null, l: 'Partidos publicados' },
              { n: stats.assocs, l: 'Asociaciones FBF' },
              { n: 'QR', l: 'Entradas 100% digitales' },
            ].map(x => (
              <div key={x.l} className="px-5 py-6 text-center">
                <p className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-lime-300">
                  {x.n ?? '—'}
                </p>
                <p className="text-[0.7rem] uppercase tracking-widest text-gray-500 mt-1">{x.l}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {clubs.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-14" id="clubes">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="eyebrow">Clubes</span>
              <h2 className="section-title text-3xl md:text-4xl mt-1">Entra al espacio de tu club</h2>
              <p className="text-gray-400 text-sm mt-2">
                Toca el escudo y descubre sus partidos, su tienda y sus planes de socio.
              </p>
            </div>
            <div className="hairline hidden md:block flex-1 mb-4 ml-6" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {clubs.map(c => (
              <Link
                key={c.id}
                to={`/club/${c.slug}`}
                className="card card-hover p-5 flex flex-col items-center gap-3 text-center group"
              >
                <ClubLogo name={c.name} logoUrl={c.logo_url} size="md" />
                <span className="font-display font-bold text-sm leading-tight group-hover:text-emerald-400 transition">
                  {c.name}
                </span>
                <span className="text-[0.65rem] uppercase tracking-widest text-gray-500">
                  {c.department || 'Bolivia'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 mt-16" id="partidos">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="eyebrow">Calendario</span>
            <h2 className="section-title text-3xl md:text-4xl mt-1">Próximos partidos</h2>
          </div>
          <div className="hairline hidden md:block flex-1 mb-4 ml-6" />
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Cargando partidos...</p>
        ) : matches.length === 0 ? (
          <div className="card p-10 text-center text-gray-400">
            Aún no hay partidos publicados. ¡Vuelve pronto!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {matches.slice(0, 6).map((m, i) => (
              <article key={m.id} className="card card-hover overflow-hidden flex flex-col">
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={CARD_IMGS[i % CARD_IMGS.length]}
                    alt=""
                    className="w-full h-full object-cover zoom-img"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d141c] via-black/30 to-transparent" />
                  <span className="badge absolute top-3 left-3 bg-black/60">{m.status}</span>
                  <span className="absolute top-3 right-3 text-[0.65rem] font-bold uppercase tracking-widest text-lime-300 bg-black/60 border border-lime-400/40 rounded-full px-2.5 py-1">
                    {m.tenants?.name}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display text-xl font-bold text-white">{m.opponent}</h3>
                  {(m.competition || m.matchday) && (
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-emerald-400 mt-1">
                      {[m.competition, m.matchday ? `Jornada ${m.matchday}` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">{m.stadium_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(m.match_date).toLocaleString()}
                  </p>
                  <Link to={`/comprar/${m.id}`} className="btn btn-primary mt-5 w-full">
                    Comprar entradas
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-16">
        <span className="eyebrow">Plataforma</span>
        <h2 className="section-title text-3xl md:text-4xl mt-1 mb-6">Explora Tribuna 360</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { img: imgSquare, title: 'Entradas con QR', text: 'Elige tu zona del estadio, paga y recibe tu código de acceso al instante.', to: '/', cta: 'Ver partidos' },
            { img: imgSmall, title: 'Tienda del club', text: 'Camisetas, bufandas y más merchandising oficial de tu club favorito.', to: '/tienda', cta: 'Ver tienda' },
            { img: imgTiny, title: 'Planes de socio', text: 'Hazte socio y accede a beneficios exclusivos durante todo el año.', to: '/socios', cta: 'Ver planes' },
          ].map(x => (
            <Link key={x.title} to={x.to} className="card card-hover overflow-hidden group flex flex-col">
              <div className="h-40 overflow-hidden">
                <img src={x.img} alt={x.title} className="w-full h-full object-cover zoom-img" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-display text-xl font-bold text-white">{x.title}</h3>
                <p className="text-sm text-gray-400 mt-2 flex-1">{x.text}</p>
                <span className="mt-4 text-sm font-bold text-emerald-400 group-hover:text-lime-300 transition">
                  {x.cta} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-16">
        <div className="relative rounded-3xl overflow-hidden border border-emerald-700/40">
          <img src={hero1} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-emerald-900/60" />
          <div className="relative px-8 py-14 md:px-16 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <span className="eyebrow">Para clubes</span>
              <h2 className="section-title text-3xl md:text-4xl mt-2">
                Lleva tu club a la tribuna digital
              </h2>
              <p className="text-gray-300 mt-3 max-w-xl">
                Registra tu estadio, tu asociación y tus datos legales. El sistema valida tu solicitud
                y en minutos tu club estará publicado, listo para vender entradas, productos y socios.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start">
                <Link to="/unete" className="btn btn-primary">
                  Únete a Tribuna 360
                </Link>
                <Link to="/login" className="btn btn-outline">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>
            <img
              src={heroPng}
              alt=""
              className="hidden md:block w-44 h-44 object-contain drop-shadow-[0_18px_40px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

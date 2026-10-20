import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import Logo from './Logo';

const navLinkCls = ({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`;

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const role = user?.role;

  const adminTab = searchParams.get('tab') || 'resumen';
  const onAdmin = location.pathname === '/admin';

  const isFan = role === 'fan';
  const isClubAdmin = role === 'club_admin';
  const isSuperadmin = role === 'superadmin';
  const isAdmin = isClubAdmin || isSuperadmin;
  const canScan = role === 'gate_operator' || isSuperadmin;
  const showsPublicNav = !token || isFan || (!isAdmin && !canScan);

  const links = [];

  if (showsPublicNav) {
    links.push(
      { to: '/', label: 'Partidos', end: true },
      { to: '/tienda', label: 'Tienda' },
      { to: '/socios', label: 'Socios' },
    );
  }

  if (!token) {
    links.push({ to: '/unete', label: 'Únete' });
  }

  if (token && isFan) {
    links.push(
      { to: '/mis-entradas', label: 'Mis Entradas' },
      { to: '/mis-pedidos', label: 'Mis Pedidos' },
      { to: '/mis-socio', label: 'Mi Membresía' },
    );
  }

  if (token && canScan) {
    links.push({ to: '/scanner', label: 'Validador QR' });
  }

  if (token && isClubAdmin) {
    links.push(
      { to: '/admin', label: 'Panel', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
      { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
      { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
      { to: '/admin?tab=mi-club', label: 'Mi club', tab: 'mi-club' },
      { to: '/admin?tab=usuarios', label: 'Personal', tab: 'usuarios' },
    );
  }

  if (token && isSuperadmin) {
    links.push(
      { to: '/admin', label: 'Panel', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
      { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
      { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
      { to: '/admin?tab=clubes', label: 'Clubes', tab: 'clubes' },
      { to: '/admin?tab=usuarios', label: 'Usuarios', tab: 'usuarios' },
    );
  }

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 px-5 py-3">
        <Link to="/" aria-label="Tribuna 360 — inicio">
          <Logo size="sm" />
        </Link>

        {links.length > 0 && (
          <nav className="hidden lg:flex items-center gap-6">
            {links.map(link => (
              link.tab ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-link whitespace-nowrap ${onAdmin && adminTab === link.tab ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ) : (
                <NavLink key={link.to} to={link.to} end={link.end} className={navLinkCls}>
                  {link.label}
                </NavLink>
              )
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {token ? (
            <>
              <span className="hidden sm:block text-sm text-gray-400">
                Hola, <span className="text-emerald-400 font-semibold">{user?.full_name || '...'}</span>
              </span>
              <button
                onClick={logout}
                className="btn btn-muted py-2 px-4 text-sm"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline py-2 px-4 text-sm">
                Iniciar Sesión
              </Link>
              <Link to="/unete" className="btn btn-primary py-2 px-4 text-sm hidden sm:inline-flex">
                Únete
              </Link>
            </>
          )}
        </div>
      </div>

      {links.length > 0 && (
        <nav className="lg:hidden flex gap-5 px-5 pb-3 overflow-x-auto border-t border-white/5 pt-3">
          {links.map(link => (
            link.tab ? (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link whitespace-nowrap ${onAdmin && adminTab === link.tab ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ) : (
              <NavLink key={link.to} to={link.to} end={link.end} className={navLinkCls}>
                {link.label}
              </NavLink>
            )
          ))}
        </nav>
      )}
    </header>
  );
}

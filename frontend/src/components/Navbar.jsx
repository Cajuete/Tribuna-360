import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import Logo from './Logo';

const ADMIN_ROLES = ['superadmin', 'club_admin'];
const SCANNER_ROLES = ['superadmin', 'club_admin', 'gate_operator'];

export default function Navbar() {
  const { user, token, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 px-5 py-3">
        <Link to="/" aria-label="Tribuna 360 — inicio">
          <Logo size="sm" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Partidos
          </NavLink>
          <NavLink to="/tienda" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Tienda
          </NavLink>
          <NavLink to="/socios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            Socios
          </NavLink>
          {!token && (
            <NavLink to="/unete" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Únete
            </NavLink>
          )}
          {token && (
            <NavLink to="/mis-entradas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Mis Entradas
            </NavLink>
          )}
          {token && (
            <NavLink to="/mis-pedidos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Mis Pedidos
            </NavLink>
          )}
          {token && (
            <NavLink to="/mis-socio" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Mi Membresía
            </NavLink>
          )}
          {user && SCANNER_ROLES.includes(user.role) && (
            <NavLink to="/scanner" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Validador QR
            </NavLink>
          )}
          {user && ADMIN_ROLES.includes(user.role) && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Admin
            </NavLink>
          )}
        </nav>

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

      {/* menú compacto móvil */}
      <nav className="lg:hidden flex gap-5 px-5 pb-3 overflow-x-auto border-t border-white/5 pt-3">
        <NavLink to="/" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`} end>
          Partidos
        </NavLink>
        <NavLink to="/tienda" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          Tienda
        </NavLink>
        <NavLink to="/socios" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
          Socios
        </NavLink>
        {!token && (
          <NavLink to="/unete" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            Únete
          </NavLink>
        )}
        {token && (
          <NavLink to="/mis-entradas" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            Mis Entradas
          </NavLink>
        )}
        {token && (
          <NavLink to="/mis-pedidos" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            Mis Pedidos
          </NavLink>
        )}
        {token && (
          <NavLink to="/mis-socio" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            Mi Membresía
          </NavLink>
        )}
        {user && ADMIN_ROLES.includes(user.role) && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
            Admin
          </NavLink>
        )}
      </nav>
    </header>
  );
}

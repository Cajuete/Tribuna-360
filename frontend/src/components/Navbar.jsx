import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Menu, X, User, Bell, CheckCircle2, Ticket, ShoppingBag, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import Logo from './Logo';

const navLinkCls = ({ isActive }) => `px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-900'}`;

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifRef = useRef(null);
  const role = user?.role;

  const adminTab = searchParams.get('tab') || 'resumen';
  const onAdmin = location.pathname === '/admin';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const links = [];

  if (!token) {
    links.push(
      { to: '/', label: 'Partidos', end: true },
      { to: '/tienda', label: 'Tienda' },
      { to: '/socios', label: 'Socios' },
      { to: '/unete', label: 'Únete' },
    );
  } else if (role === 'fan') {
    links.push(
      { to: '/', label: 'Partidos', end: true },
      { to: '/tienda', label: 'Tienda' },
      { to: '/socios', label: 'Socios' },
      { to: '/mis-entradas', label: 'Entradas' },
      { to: '/mis-pedidos', label: 'Pedidos' },
      { to: '/mis-socio', label: 'Membresía' },
      { to: '/mi-perfil', label: 'Mi Perfil' },
    );
  } else if (role === 'gate_operator') {
    links.push({ to: '/scanner', label: 'Validador de Torniquete (PWA)' });
  } else if (role === 'box_office_cashier') {
    links.push(
      { to: '/admin', label: 'POS Taquilla Física', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Emisión de Boletos', tab: 'partidos' },
    );
  } else if (role === 'sales_manager') {
    links.push(
      { to: '/ventas', label: 'Promociones' },
      { to: '/admin', label: 'Panel Comercial', tab: 'resumen' },
      { to: '/admin?tab=tienda', label: 'Gestión Tienda', tab: 'tienda' },
      { to: '/admin?tab=pedidos', label: 'Pedidos', tab: 'pedidos' },
      { to: '/admin?tab=reportes', label: 'Reportes', tab: 'reportes' },
    );
  } else if (role === 'stadium_manager') {
    links.push(
      { to: '/admin', label: 'Control Estadio', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Zonas y Aforo', tab: 'partidos' },
    );
  } else if (role === 'financial_auditor') {
    links.push(
      { to: '/admin', label: 'Auditoría Financiera', tab: 'resumen' },
      { to: '/admin?tab=pedidos', label: 'Transacciones', tab: 'pedidos' },
      { to: '/admin?tab=socios', label: 'Socios & Ingresos', tab: 'socios' },
      { to: '/admin?tab=reportes', label: 'Liquidación Taquilla', tab: 'reportes' },
    );
  } else if (role === 'customer_support') {
    links.push(
      { to: '/admin', label: 'Soporte Técnico', tab: 'resumen' },
      { to: '/admin?tab=pedidos', label: 'Incidencias Pedidos', tab: 'pedidos' },
      { to: '/admin?tab=socios', label: 'Incidencias Socios', tab: 'socios' },
    );
  } else if (role === 'club_admin') {
    links.push(
      { to: '/admin', label: 'Gerencia Club', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
      { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
      { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
      { to: '/admin?tab=mi-club', label: 'Institución', tab: 'mi-club' },
    );
  } else if (role === 'superadmin') {
    links.push(
      { to: '/admin', label: 'SaaS Dashboard', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
      { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
      { to: '/admin?tab=clubes', label: 'Clubes Tenants', tab: 'clubes' },
    );
  }

  // Role notifications
  let notifications = [];
  if (role === 'fan') {
    notifications = [
      { id: 1, title: 'Boleto Digital QR', desc: 'Tu entrada está lista en Mis Entradas.', time: 'Activo', icon: Ticket },
    ];
  } else if (role === 'gate_operator') {
    notifications = [
      { id: 1, title: 'Validador de Puerta', desc: 'Escáner de torniquete activo en tiempo real.', time: 'Turno', icon: ShieldCheck },
    ];
  } else if (role === 'box_office_cashier') {
    notifications = [
      { id: 1, title: 'POS de Boletería Física', desc: 'Emisión y arqueo de caja operativos.', time: 'Caja', icon: Ticket },
    ];
  } else if (role === 'financial_auditor') {
    notifications = [
      { id: 1, title: 'Auditoría Activa', desc: 'Libro de transacciones y liquidación auditadas.', time: 'Finanzas', icon: ShieldCheck },
    ];
  } else {
    notifications = [
      { id: 1, title: 'Panel Enterprise', desc: `Sesión activa como ${role || 'Admin'}.`, time: 'SaaS', icon: LayoutDashboard },
    ];
  }

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10 shadow-xl">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 px-6 py-4">
        <Link to="/" aria-label="Tribuna 360 — inicio" className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* Desktop Navigation */}
        {links.length > 0 && (
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-950/85 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
            {links.map(link => (
              link.tab ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${onAdmin && adminTab === link.tab ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-900'}`}
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

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {token ? (
            <>
              {/* Notification Tray */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-label="Notificaciones"
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition relative shadow-sm"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-bold text-[0.65rem] w-4.5 h-4.5 rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-3 w-80 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <p className="font-display font-bold text-sm text-white">Centro de Alertas</p>
                      <span className="text-[0.65rem] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">{role}</span>
                    </div>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {notifications.map(n => {
                        const IconComp = n.icon;
                        return (
                          <div key={n.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{n.title}</p>
                              <p className="text-[0.7rem] text-slate-400 mt-0.5 leading-relaxed">{n.desc}</p>
                              <p className="text-[0.6rem] text-slate-500 mt-1">{n.time}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <Link to="/mi-perfil" className="text-right hover:opacity-80 transition group flex items-center gap-3 bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl shadow-sm">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[0.6rem] text-slate-400 uppercase tracking-widest font-bold">Perfil</p>
                  <p className="text-xs font-bold text-emerald-300">{user?.full_name?.split(' ')?.[0] || 'Usuario'}</p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="btn btn-muted py-2.5 px-4 text-xs font-bold uppercase tracking-wider"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline py-2.5 px-5 text-xs font-bold uppercase tracking-wider">
                Ingresar
              </Link>
              <Link to="/unete" className="btn btn-primary py-2.5 px-5 text-xs font-bold uppercase tracking-wider">
                Únete
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Abrir menú"
          className="lg:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-emerald-400 transition"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-slate-950/98 backdrop-blur-xl border-b border-slate-800 p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          {token && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Rol: {role}</p>
                <p className="font-bold text-white text-sm truncate">{user?.full_name || 'Usuario'}</p>
              </div>
              <Link
                to="/mi-perfil"
                onClick={() => setMobileMenuOpen(false)}
                className="text-xs font-bold text-emerald-400 underline shrink-0"
              >
                Perfil
              </Link>
            </div>
          )}

          {links.length > 0 && (
            <nav className="flex flex-col gap-2">
              {links.map(link => (
                link.tab ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider block transition ${onAdmin && adminTab === link.tab ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-900/60 text-slate-300 hover:bg-slate-900'}`}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => `px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider block transition ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-900/60 text-slate-300 hover:bg-slate-900'}`}
                  >
                    {link.label}
                  </NavLink>
                )
              ))}
            </nav>
          )}

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-3">
            {token ? (
              <button
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="btn btn-muted w-full py-3.5 text-sm font-bold uppercase tracking-wider text-red-400 border-red-900/50"
              >
                Cerrar Sesión
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-outline py-3.5 text-sm font-bold uppercase tracking-wider text-center"
                >
                  Ingresar
                </Link>
                <Link
                  to="/unete"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary py-3.5 text-sm font-bold uppercase tracking-wider text-center"
                >
                  Únete
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

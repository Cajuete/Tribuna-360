import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import {
  Menu,
  X,
  User,
  Bell,
  Ticket,
  ShieldCheck,
  LayoutDashboard,
  CircleDot,
  ShoppingCart,
  Users,
  UserPlus,
  ClipboardList,
  CreditCard,
  BadgeCheck,
  ScanLine,
  Tag,
  Store,
  Building2,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { useCart } from '../context/cart-context';
import Logo from './Logo';

const navIcons = {
  '/partidos': CircleDot,
  '/tienda': Store,
  '/socios': Users,
  '/unete': UserPlus,
  '/mis-entradas': Ticket,
  '/mis-pedidos': ClipboardList,
  '/mis-pagos': CreditCard,
  '/mis-socio': BadgeCheck,
  '/scanner': ScanLine,
  '/ventas': Tag,
};

const adminTabIcons = {
  resumen: LayoutDashboard,
  partidos: CircleDot,
  tienda: Store,
  pedidos: ClipboardList,
  reportes: BarChart3,
  socios: Users,
  'mi-club': Building2,
  pagos: CreditCard,
  clubes: Building2,
};

const getNavIcon = (link) => (
  (link.tab && adminTabIcons[link.tab])
  || navIcons[link.to]
  || LayoutDashboard
);

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifRef = useRef(null);
  const role = user?.role;
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartIsActive = location.pathname === '/carrito';
  const cartIsHighlighted = cartItemCount > 0 || cartIsActive;
  const canShop = !token || role === 'fan';

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
      { to: '/partidos', label: 'Partidos' },
      { to: '/tienda', label: 'Tienda' },
      { to: '/socios', label: 'Socios' },
      { to: '/unete', label: 'Registrar mi club' },
    );
  } else if (role === 'fan') {
    links.push(
      { to: '/partidos', label: 'Partidos' },
      { to: '/tienda', label: 'Tienda' },
      { to: '/socios', label: 'Socios' },
      { to: '/mis-entradas', label: 'Entradas' },
      { to: '/mis-pedidos', label: 'Pedidos' },
      { to: '/mis-pagos', label: 'Mis pagos' },
      { to: '/mis-socio', label: 'Membresía' },
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
      { to: '/admin?tab=pagos', label: 'Pagos', tab: 'pagos' },
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
      { to: '/admin?tab=pagos', label: 'Pagos', tab: 'pagos' },
    );
  } else if (role === 'payment_manager') {
    links.push(
      { to: '/admin', label: 'Panel', tab: 'resumen' },
      { to: '/admin?tab=pagos', label: 'Pagos', tab: 'pagos' },
    );
  } else if (role === 'delivery_manager') {
    links.push({ to: '/admin?tab=pedidos', label: 'Despachos', tab: 'pedidos' });
  } else if (role === 'superadmin') {
    links.push(
      { to: '/admin', label: 'SaaS Dashboard', tab: 'resumen' },
      { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
      { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
      { to: '/admin?tab=clubes', label: 'Clubes Tenants', tab: 'clubes' },
      { to: '/admin?tab=pagos', label: 'Pagos', tab: 'pagos' },
    );
  }

  // Role notifications
  const notifications = role === 'fan'
    ? [{ id: 1, title: 'Boleto Digital QR', desc: 'Tu entrada está lista en Mis Entradas.', time: 'Activo', icon: Ticket }]
    : role === 'gate_operator'
      ? [{ id: 1, title: 'Validador de Puerta', desc: 'Escáner de torniquete activo en tiempo real.', time: 'Turno', icon: ShieldCheck }]
      : role === 'box_office_cashier'
        ? [{ id: 1, title: 'POS de Boletería Física', desc: 'Emisión y arqueo de caja operativos.', time: 'Caja', icon: Ticket }]
        : role === 'financial_auditor'
          ? [{ id: 1, title: 'Auditoría Activa', desc: 'Libro de transacciones y liquidación auditadas.', time: 'Finanzas', icon: ShieldCheck }]
          : [{ id: 1, title: 'Panel Enterprise', desc: `Sesión activa como ${role || 'Admin'}.`, time: 'SaaS', icon: LayoutDashboard }];

  return (
    <header className="site-header sticky top-0 z-50 glass border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 px-6 py-4">
        <Link to="/" aria-label="Tribuna 360 — inicio" className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* Desktop Navigation */}
        {links.length > 0 && (
          <nav className="site-nav hidden lg:flex items-center gap-1.5">
            {links.map((link, index) => {
              const Icon = getNavIcon(link);
              const tooltip = (
                <span id={`desktop-nav-tooltip-${index}`} role="tooltip" className="site-nav-tooltip">
                  {link.label}
                </span>
              );

              return link.tab ? (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-label={link.label}
                    aria-current={onAdmin && adminTab === link.tab ? 'page' : undefined}
                    aria-describedby={`desktop-nav-tooltip-${index}`}
                    className={`site-nav-link site-nav-icon-link ${onAdmin && adminTab === link.tab ? 'is-active' : ''}`}
                  >
                    <Icon className="site-nav-icon" aria-hidden="true" />
                    {tooltip}
                  </Link>
                ) : (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    aria-label={link.label}
                    aria-describedby={`desktop-nav-tooltip-${index}`}
                    className={({ isActive }) => `site-nav-link site-nav-icon-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon className="site-nav-icon" aria-hidden="true" />
                    {tooltip}
                  </NavLink>
              );
            })}
          </nav>
        )}

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {canShop && (
            <Link
              to="/carrito"
              aria-current={cartIsActive ? 'page' : undefined}
              aria-label={`Carrito${cartItemCount ? `, ${cartItemCount} artículos` : ', vacío'}`}
              className={`relative p-3 rounded-xl border transition shadow-sm hover:text-emerald-400 hover:border-emerald-500/50 ${
                cartIsHighlighted
                  ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              {cartItemCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[0.65rem] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          )}
          {token ? (
            <>
              {/* Notification Tray */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-label={`Notificaciones${notifications.length ? `, ${notifications.length} pendientes` : ''}`}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition relative shadow-sm"
                >
                  <Bell className="w-4 h-4" />
                  <span aria-hidden="true" className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-bold text-[0.65rem] w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-slate-950">
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
                Registrar mi club
              </Link>
            </>
          )}
        </div>

        <div className="lg:hidden flex items-center gap-2">
          {canShop && (
            <Link
              to="/carrito"
              aria-current={cartIsActive ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
              aria-label={`Carrito${cartItemCount ? `, ${cartItemCount} artículos` : ', vacío'}`}
              className={`relative p-2.5 rounded-xl border transition hover:text-emerald-400 ${
                cartIsHighlighted
                  ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
              {cartItemCount > 0 && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-slate-950 text-[0.65rem] font-bold flex items-center justify-center ring-2 ring-slate-950">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-emerald-400 transition"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-slate-950/98 backdrop-blur-xl border-b border-slate-800 p-6 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          {token && (
            <Link
              to="/mi-perfil"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Rol: {role}</p>
                <p className="font-bold text-white text-sm truncate">{user?.full_name || 'Usuario'}</p>
              </div>
            </Link>
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
                  Registrar mi club
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

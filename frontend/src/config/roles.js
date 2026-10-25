export const ROLE_LABELS = {
  superadmin: 'Superadmin',
  club_admin: 'Admin de club',
  sales_manager: 'Gerente de ventas',
  box_office_cashier: 'Taquillero',
  stadium_manager: 'Gerente de estadio',
  financial_auditor: 'Auditor financiero',
  customer_support: 'Soporte',
  gate_operator: 'Operador de puerta',
  fan: 'Hincha',
};

export const STAFF_ROLES = [
  'sales_manager',
  'box_office_cashier',
  'stadium_manager',
  'financial_auditor',
  'customer_support',
  'gate_operator',
];

export const VALID_ROLES = [
  'superadmin',
  'club_admin',
  'sales_manager',
  'box_office_cashier',
  'stadium_manager',
  'financial_auditor',
  'customer_support',
  'gate_operator',
  'fan',
];

export const ROLE_NAV_LINKS = {
  fan: [
    { to: '/', label: 'Partidos', end: true },
    { to: '/tienda', label: 'Tienda' },
    { to: '/socios', label: 'Socios' },
    { to: '/mis-entradas', label: 'Entradas' },
    { to: '/mis-pedidos', label: 'Pedidos' },
    { to: '/mis-socio', label: 'Membresía' },
    { to: '/mi-perfil', label: 'Mi Perfil' },
  ],
  gate_operator: [
    { to: '/scanner', label: 'Validador QR' },
  ],
  sales_manager: [
    { to: '/ventas', label: 'Promociones' },
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
    { to: '/admin?tab=pedidos', label: 'Pedidos', tab: 'pedidos' },
    { to: '/admin?tab=reportes', label: 'Reportes', tab: 'reportes' },
  ],
  stadium_manager: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=partidos', label: 'Zonas', tab: 'partidos' },
  ],
  financial_auditor: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=pedidos', label: 'Pedidos', tab: 'pedidos' },
    { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
  ],
  customer_support: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=pedidos', label: 'Pedidos', tab: 'pedidos' },
    { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
  ],
  box_office_cashier: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=partidos', label: 'Taquilla POS', tab: 'partidos' },
  ],
  club_admin: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
    { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
    { to: '/admin?tab=socios', label: 'Socios', tab: 'socios' },
    { to: '/admin?tab=mi-club', label: 'Mi Club', tab: 'mi-club' },
  ],
  superadmin: [
    { to: '/admin', label: 'Panel', tab: 'resumen' },
    { to: '/admin?tab=partidos', label: 'Partidos', tab: 'partidos' },
    { to: '/admin?tab=tienda', label: 'Tienda', tab: 'tienda' },
    { to: '/admin?tab=clubes', label: 'Clubes', tab: 'clubes' },
    { to: '/admin?tab=plataforma', label: 'Plataforma', tab: 'plataforma' },
  ],
};

export const GUEST_NAV_LINKS = [
  { to: '/', label: 'Partidos', end: true },
  { to: '/tienda', label: 'Tienda' },
  { to: '/socios', label: 'Socios' },
  { to: '/unete', label: 'Únete' },
];

export const ADMIN_TABS_BY_ROLE = {
  superadmin: ['resumen', 'partidos', 'tienda', 'clubes', 'plataforma', 'usuarios'],
  club_admin: ['resumen', 'partidos', 'tienda', 'socios', 'mi-club', 'usuarios'],
  sales_manager: ['resumen', 'tienda', 'pedidos', 'reportes'],
  stadium_manager: ['resumen', 'partidos'],
  financial_auditor: ['resumen', 'pedidos', 'socios'],
  customer_support: ['resumen', 'pedidos', 'socios'],
  box_office_cashier: ['resumen', 'partidos'],
};

export const TAB_LABELS = {
  resumen: 'Resumen',
  partidos: 'Partidos',
  tienda: 'Tienda',
  socios: 'Socios',
  'mi-club': 'Mi club',
  clubes: 'Clubes',
  plataforma: 'Plataforma SaaS',
  usuarios: 'Usuarios',
  pedidos: 'Pedidos',
  reportes: 'Reportes',
};

export function getAdminTabs(role) {
  const ids = ADMIN_TABS_BY_ROLE[role] || ['resumen'];
  return ids.map((id) => ({ id, label: TAB_LABELS[id] || id }));
}

export const ROUTE_ROLES = {
  scanner: ['superadmin', 'gate_operator'],
  ventas: ['superadmin', 'club_admin', 'sales_manager'],
  admin: [
    'superadmin',
    'club_admin',
    'sales_manager',
    'stadium_manager',
    'financial_auditor',
    'customer_support',
    'box_office_cashier',
  ],
};

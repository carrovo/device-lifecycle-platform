export const ROUTES = Object.freeze({
  login: '/login',
  feishuCallback: '/login/feishu/callback',
  home: '/home',
  dashboard: '/dashboard',
  erpCenter: '/erp-center',
  production: '/production',
  projects: '/projects',
  assets: '/assets',
  afterSales: '/after-sales',
  system: '/system',
});

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const PROTECTED_ROOT_ROUTES: AppRoute[] = [
  ROUTES.home,
  ROUTES.dashboard,
  ROUTES.erpCenter,
  ROUTES.production,
  ROUTES.projects,
  ROUTES.assets,
  ROUTES.afterSales,
  ROUTES.system,
];

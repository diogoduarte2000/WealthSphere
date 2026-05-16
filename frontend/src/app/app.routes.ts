import { Routes } from '@angular/router';

const primaryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
  },
  {
    path: 'dashboard-user',
    loadComponent: () => import('./pages/dashboard/dashboard-user.component').then(m => m.DashboardUserComponent)
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then(m => m.AuthComponent)
  },
  {
    path: 'forum',
    loadComponent: () => import('./pages/forum/forum.component').then(m => m.ForumComponent)
  }
];

const featureRoutes: Routes = [
  {
    path: 'income',
    loadComponent: () => import('./pages/income/income').then(m => m.IncomeComponent)
  },
  {
    path: 'simulador',
    loadComponent: () => import('./pages/simulador/simulador').then(m => m.SimuladorComponent)
  },
    {
    path: 'dashboard-demo',
    loadComponent: () => import('./pages/dashboard/dashboard-demo.component').then(m => m.DashboardDemoComponent)
  },
  {
    path: 'rendas',
    loadComponent: () => import('./pages/rendas/rendas').then(m => m.Rendas)
  },
  {
    path: 'taxas',
    loadComponent: () => import('./pages/taxas/taxas').then(m => m.Taxas)
  },
  {
    path: 'mercados',
    loadComponent: () => import('./pages/mercados/mercados').then(m => m.Mercados)
  },
  {
    path: 'perfil',
    loadComponent: () => import('./pages/perfil/perfil').then(m => m.Perfil)
  },
  {
    path: 'definicoes',
    loadComponent: () => import('./pages/definicoes/definicoes').then(m => m.Definicoes)
  }
];

export const routes: Routes = [
  ...primaryRoutes,
  ...featureRoutes,
  {
    path: '**',
    redirectTo: ''
  }
];

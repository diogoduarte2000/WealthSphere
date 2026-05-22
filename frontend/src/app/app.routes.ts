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
    path: 'dashboard-demo',
    loadComponent: () => import('./pages/dashboard/dashboard-demo.component').then(m => m.DashboardDemoComponent)
  },
  
];

export const routes: Routes = [
  ...primaryRoutes,
  ...featureRoutes,
  {
    path: '**',
    redirectTo: ''
  }
];

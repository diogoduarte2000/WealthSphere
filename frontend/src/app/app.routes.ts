import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent).catch(() => import('./pages/landing/landing').then(m => m.Landing))
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent).catch(() => import('./pages/dashboard/dashboard').then(m => m.Dashboard))
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.component').then(m => m.AuthComponent).catch(() => import('./pages/auth/auth.component').then(m => m.AuthComponent))
  },
  {
    path: 'forum',
    loadComponent: () => import('./pages/forum/forum.component').then(m => m.ForumComponent).catch(() => import('./pages/forum/forum.component').then(m => m.ForumComponent))
  }
];
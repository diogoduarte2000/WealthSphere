const fs = require('fs');
const path = require('path');

const appCompHtmlPath = path.join(__dirname, '../frontend/src/app/app.component.html');
const landingCompHtmlPath = path.join(__dirname, '../frontend/src/app/pages/landing/landing.component.html');
const appRoutesPath = path.join(__dirname, '../frontend/src/app/app.routes.ts');

// 1. Move app.component.html content to landing.component.html
const appHtmlContent = fs.readFileSync(appCompHtmlPath, 'utf8');

// The Angular CLI generates the .html files with slightly different names depending on version.
// Let's check what the name is. It might be landing.html or landing.component.html.
const landingDest = fs.existsSync(landingCompHtmlPath) ? landingCompHtmlPath : path.join(__dirname, '../frontend/src/app/pages/landing/landing.html');
fs.writeFileSync(landingDest, appHtmlContent);

// 2. Set app.component.html to just <router-outlet></router-outlet>
fs.writeFileSync(appCompHtmlPath, '<router-outlet></router-outlet>');

// 3. Update app.routes.ts
const routesContent = `
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
`;

fs.writeFileSync(appRoutesPath, routesContent.trim());

console.log('Routes and files set up.');

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError, catchError, switchMap, from } from 'rxjs';
import { environment } from '../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('wealthsphere_access_token');
  const router = inject(Router);

  let clonedReq = req;
  if (token && req.url.startsWith(environment.apiUrl)) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If unauthorized and not already trying to refresh
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        const refreshToken = localStorage.getItem('wealthsphere_refresh_token');
        
        if (refreshToken) {
          // Use fetch to avoid circular dependency with HttpClient
          return from(
            fetch(`${environment.apiUrl}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            }).then(res => {
              if (!res.ok) throw new Error('Refresh failed');
              return res.json();
            })
          ).pipe(
            switchMap((res: any) => {
              // Save new tokens
              localStorage.setItem('wealthsphere_access_token', res.tokens.accessToken);
              localStorage.setItem('wealthsphere_refresh_token', res.tokens.refreshToken);
              
              // Retry original request with new token
              const retriedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${res.tokens.accessToken}`
                }
              });
              return next(retriedReq);
            }),
            catchError((err) => {
              // Refresh failed, logout
              localStorage.removeItem('wealthsphere_access_token');
              localStorage.removeItem('wealthsphere_refresh_token');
              localStorage.removeItem('wealthsphere_user');
              router.navigate(['/auth']);
              return throwError(() => error);
            })
          );
        } else {
          // No refresh token, logout
          localStorage.removeItem('wealthsphere_access_token');
          localStorage.removeItem('wealthsphere_user');
          router.navigate(['/auth']);
        }
      }
      return throwError(() => error);
    })
  );
};

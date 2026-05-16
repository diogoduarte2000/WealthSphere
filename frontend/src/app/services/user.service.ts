import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExternalApis {
  steam?: {
    steamId: string;
    inventoryValue?: number;
    lastSync?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`);
  }

  updateExternalApis(data: { steamId?: string; trading212ApiKey?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me/external-apis`, data);
  }

  getSteamInventory(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/steam/inventory`);
  }

  unlinkSteam(): Observable<any> {
    return this.http.post(`${this.apiUrl}/unlink-steam`, {});
  }
}

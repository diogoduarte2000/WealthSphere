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

  updateProfile(data: { displayName?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me`, data);
  }

  updateExternalApis(data: { 
    steamId?: string; 
    trading212ApiKey?: string;
    binanceApiKey?: string;
    binanceApiSecret?: string;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me/external-apis`, data);
  }

  updateFinancialData(data: {
    netWorth?: number;
    monthlyIncome?: number;
    monthlyExpenses?: number;
    etfPortfolio?: number;
    realEstateValue?: number;
    cryptoValue?: number;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me/financial-data`, data);
  }

  getSteamInventory(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/steam/inventory`);
  }

  getSteamItemPrice(name: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/steam/price?name=${encodeURIComponent(name)}`);
  }

  getSteamItemFloat(inspectLink: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/steam/float?inspectLink=${encodeURIComponent(inspectLink)}`);
  }

  unlinkSteam(): Observable<any> {
    return this.http.post(`${this.apiUrl}/unlink-steam`, {});
  }

  updateCustomSettings(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me/settings`, data);
  }

  updateRealEstate(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/me/real-estate`, data);
  }

  getT212Portfolio(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/trading212/portfolio`);
  }
}

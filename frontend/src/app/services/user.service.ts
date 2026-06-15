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

  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/me`);
  }

  updateExternalApis(data: {
    steamId?: string;
    trading212ApiKey?: string;
    binanceApiKey?: string;
    binanceApiSecret?: string;
    krakenApiKey?: string;
    krakenApiSecret?: string;
    paypalClientId?: string;
    paypalClientSecret?: string;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/me/external-apis`, data);
  }

  getBinanceBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/binance/balance`);
  }

  getKrakenBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/kraken/balance`);
  }

  getPaypalBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/paypal/balance`);
  }

  getMarketData(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/market-data`);
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

  getSteamInventory(game: string = 'cs2', force: boolean = false): Observable<any> {
    const params = `game=${encodeURIComponent(game)}${force ? '&force=true' : ''}`;
    return this.http.get(`${environment.apiUrl}/external/steam/inventory?${params}`);
  }

  getSteamItemPrice(name: string, game: string = 'cs2'): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/steam/price?name=${encodeURIComponent(name)}&game=${encodeURIComponent(game)}`);
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

  getT212History(days: number = 90): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/trading212/history?days=${days}`);
  }

  searchStocks(q: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/stocks/search?q=${encodeURIComponent(q)}`);
  }

  getStockQuote(symbol: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/stocks/quote?symbol=${encodeURIComponent(symbol)}`);
  }

  getStockChart(symbol: string, period: string = '1mo'): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/stocks/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`);
  }

  getStockNews(symbol: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/stocks/news?symbol=${encodeURIComponent(symbol)}`);
  }

  getTrendingStocks(cat: string = 'tendencias'): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/stocks/trending?cat=${encodeURIComponent(cat)}`);
  }

  getCoinbaseBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/coinbase/balance`);
  }

  getWiseBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/external/wise/balance`);
  }

  getGoals(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/me/goals`);
  }

  addGoal(goal: { label: string; target: number; deadline?: string }): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/me/goals`, goal);
  }

  updateGoal(id: string, data: Partial<{ label: string; target: number; deadline: string; notified: boolean }>): Observable<any[]> {
    return this.http.put<any[]>(`${this.apiUrl}/me/goals/${id}`, data);
  }

  deleteGoal(id: string): Observable<any[]> {
    return this.http.delete<any[]>(`${this.apiUrl}/me/goals/${id}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, take } from 'rxjs';

interface RateData {
  euribor3m: number;
  euribor6m: number;
  euribor12m: number;
  teag: number;
  bceDeposit: number;
  ipc: number;
  lastUpdate: string;
}

@Injectable({
  providedIn: 'root'
})
export class RatesService {
  private ratesSubject = new BehaviorSubject<RateData>({
    euribor3m: 2.39,
    euribor6m: 2.61,
    euribor12m: 2.78,
    teag: 4.12,
    bceDeposit: 2.25,
    ipc: 2.3,
    lastUpdate: new Date().toISOString()
  });

  rates$ = this.ratesSubject.asObservable();

  constructor(private http: HttpClient) {
    // Atualizar taxas a cada hora
    interval(3600000).subscribe(() => this.fetchRates());
    
    // Buscar taxas iniciais
    this.fetchRates();
  }

  private fetchRates(): void {
    // TODO: Implementar chamada real à API do Banco de Portugal/ECB
    // Por enquanto, usar valores mockados
    this.http.get<any>('https://api.bancodeportugal.pt/v1/rates').pipe(take(1)).subscribe({
      next: (data) => {
        this.ratesSubject.next({
          euribor3m: data.euribor3m || 2.39,
          euribor6m: data.euribor6m || 2.61,
          euribor12m: data.euribor12m || 2.78,
          teag: data.teag || 4.12,
          bceDeposit: data.bceDeposit || 2.25,
          ipc: data.ipc || 2.3,
          lastUpdate: new Date().toISOString()
        });
      },
      error: () => {
        console.log('Using mock rates data');
      }
    });
  }

  getCurrentRates(): RateData {
    return this.ratesSubject.value;
  }

  getEuribor6M(): number {
    return this.ratesSubject.value.euribor6m;
  }
}

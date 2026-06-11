import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';

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
    euribor3m: 2.85,
    euribor6m: 3.02,
    euribor12m: 3.18,
    teag: 4.35,
    bceDeposit: 2.75,
    ipc: 2.1,
    lastUpdate: new Date().toISOString()
  });

  rates$ = this.ratesSubject.asObservable();

  constructor() {
    // Atualizar taxas a cada hora
    interval(3600000).subscribe(() => this.fetchRates());
    
    // Buscar taxas iniciais
    this.fetchRates();
  }

  private fetchRates(): void {
    this.ratesSubject.next({
      ...this.ratesSubject.value,
      lastUpdate: new Date().toISOString()
    });
  }

  getCurrentRates(): RateData {
    return this.ratesSubject.value;
  }

  getEuribor6M(): number {
    return this.ratesSubject.value.euribor6m;
  }
}

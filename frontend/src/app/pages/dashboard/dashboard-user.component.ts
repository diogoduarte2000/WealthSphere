import { Component, AfterViewInit, ElementRef, ViewChild, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['./dashboard-user.component.css']
})
export class DashboardUserComponent implements OnInit, AfterViewInit {
  @ViewChild('patrimonioChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  currentPage: string = 'dashboard';
  modalOpen: boolean = false;
  currentChartPeriod: string = '6m';
  showUserMenu: boolean = false;
  
  userName: string = 'Utilizador';
  userInitial: string = 'U';
  userAvatar: string = '';
  userEmail: string = '';
  userSteamId: string = '';
  userSteamName: string = '';
  userSteamAvatar: string = '';

  titles: { [key: string]: [string, string] } = {
    dashboard: ['Dashboard', 'Domingo, 10 de Maio · Euribor 6M: 3.02% ↓'],
    income: ['Income Tracker', 'Maio 2025 · €1.920 de receitas'],
    taxas: ['Taxas & Mercados', 'Dados em tempo real · BCE · Banco de Portugal'],
    cs2: ['CS2 & Steam', 'Inventário sincronizado · 14 itens · €624'],
    comunidade: ['Comunidade', '487 membros ativos · 1.240 posts'],
    rendas: ['Rendas & Imóveis', '2 imóveis · €1.200/mês'],
    simulador: ['Simulador', 'Juros compostos · FIRE · Amortizações'],
    perfil: ['Perfil', 'Lisboa 🇵🇹'],
  };

  data = {
    '6m': {
      networth: [0, 0, 0, 0, 0, 0, 0],
      etf: [0, 0, 0, 0, 0, 0, 0],
      rendas: [0, 0, 0, 0, 0, 0, 0]
    },
    '1a': {
      networth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      etf: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      rendas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    '3a': {
      networth: Array(25).fill(0),
      etf: Array(25).fill(0),
      rendas: Array(25).fill(0)
    }
  };

  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  steamInventory: any = null;
  steamLoading: boolean = false;
  steamError: string = '';
  currentSteamTab: string = 'inventario';

  // ROI Calculator
  roiCalc = {
    selectedItem: '0,0',
    buyPrice: 27.20,
    sellPrice: 33.20,
    qty: 1,
    date: '2024-11-10',
    results: {
      lucro: 0,
      liquido: 0,
      roi: 0,
      anual: 0,
      dias: 0,
      comissao: 0
    }
  };

  // Case Simulator
  caseSim = {
    selected: {
      name: 'Revolution Case',
      price: '€0.87',
      ev: 1.42,
      cost: 3.06,
      diff: -1.64
    },
    numSim: 10,
    simResult: ''
  };

  // Advanced Simulator State
  currentSimTab: string = 'juros';
  simView: 'grid' | 'details' = 'grid';
  simSearch: string = '';
  
  simJuros = {
    principal: 1000,
    monthly: 200,
    rate: 7,
    years: 20,
    results: {
      total: 0,
      invested: 0,
      profit: 0
    }
  };

  simCH = {
    amount: 150000,
    years: 30,
    euribor: 3.2,
    spread: 0.8,
    results: {
      prestacao: 0,
      totalJuros: 0,
      taeg: 4.2
    }
  };

  simFIRE = {
    gastos: 1500,
    currentWealth: 10000,
    savings: 800,
    return: 7,
    results: {
      target: 450000,
      yearsToFire: 0,
      fireDate: ''
    }
  };

  marketRates = [
    { bank: 'BCE (Europa)', rate: '4.50%', trend: 'estável', asset: 'Euribor 6M: 3.2%' },
    { bank: 'FED (EUA)', rate: '5.50%', trend: 'estável', asset: 'Treasury 10Y: 4.1%' },
    { bank: 'Caixa Geral', rate: '3.75%', trend: 'promo', asset: 'Spread Base: 0.9%' },
    { bank: 'Santander', rate: '3.80%', trend: 'promo', asset: 'Spread Base: 0.85%' },
    { bank: 'Novo Banco', rate: '4.00%', trend: 'alta', asset: 'Spread Base: 1.0%' }
  ];

  simCategories = [
    { id: 'ch', title: 'Crédito Habitação', desc: 'Simula prestações, Euribor e amortizações.', icon: '🏠', tags: ['banco', 'casa', 'prestação'] },
    { id: 'juros', title: 'Juros Compostos', desc: 'O poder do tempo no teu investimento.', icon: '📈', tags: ['etf', 'poupança', 'futuro'] },
    { id: 'fire', title: 'Calculadora FIRE', desc: 'Quando podes deixar de trabalhar?', icon: '🔥', tags: ['independência', 'reforma'] },
    { id: 'mercado', title: 'Taxas & Euribor', desc: 'Comparativo de bancos e taxas reais.', icon: '🌍', tags: ['mercado', 'bce', 'fed'] },
    { id: 'rendas', title: 'Rendas & Imóveis', desc: 'Cálculo de yield e rentabilidade.', icon: '🔑', tags: ['aluguer', 'imobiliário'] },
    { id: 'inflacao', title: 'Poder de Compra', desc: 'O impacto da inflação no teu dinheiro.', icon: '💸', tags: ['custo de vida', 'preços'] }
  ];

  get filteredSims() {
    return this.simCategories.filter(c => 
      c.title.toLowerCase().includes(this.simSearch.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(this.simSearch.toLowerCase()))
    );
  }

  @ViewChild('trendChart', { static: false }) trendChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('compareChart', { static: false }) compareChartCanvas!: ElementRef<HTMLCanvasElement>;

  ngOnInit() {
    const userStr = localStorage.getItem('wealthsphere_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user) {
          this.userName = user.displayName || user.name || 'Utilizador';
          this.userInitial = this.userName.charAt(0).toUpperCase();
          this.userAvatar = user.avatar || '';
          this.userEmail = user.email || '';
          this.userSteamId = user.steamId || '';
          this.titles['perfil'] = ['Perfil', `${this.userName} · Lisboa 🇵🇹`];
        }
      } catch (e) {
        console.error('Error parsing user', e);
      }
    }
    this.loadProfile();
  }

  initChart(): void {
    // Initialize chart here
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    localStorage.removeItem('wealthsphere_access_token');
    localStorage.removeItem('wealthsphere_refresh_token');
    localStorage.removeItem('wealthsphere_user');
    this.router.navigate(['/auth']);
  }

  loginWithSteam() {
    const token = localStorage.getItem('wealthsphere_access_token');
    const linkUrl = `${environment.apiUrl}/auth/steam${token ? '?token=' + token : ''}`;
    window.location.href = linkUrl;
  }

  unlinkSteam() {
    if (confirm('Tens a certeza que queres desassociar a tua conta Steam?')) {
      this.userService.unlinkSteam().subscribe({
        next: () => {
          this.steamInventory = null;
          this.steamError = '';
          alert('Conta Steam desassociada com sucesso.');
          window.location.reload();
        },
        error: (err) => alert('Erro ao desassociar conta.')
      });
    }
  }

  loadProfile() {
    this.userService.getProfile().subscribe({
      next: (res) => {
        const user = res.profile;
        this.userName = user.displayName || user.name || 'Utilizador';
        this.userEmail = user.email || '';
        this.userAvatar = user.avatar || '';
        this.userInitial = this.userName.charAt(0).toUpperCase();
        this.userSteamId = user.steamId || '';
        this.userSteamName = user.steamName || '';
        this.userSteamAvatar = user.steamAvatar || '';
        
        // Sincronizar local storage com dados frescos
        localStorage.setItem('wealthsphere_user', JSON.stringify(user));

        if (user.steamId) {
          this.loadSteamInventory();
        }
      }
    });
  }

  loadSteamInventory() {
    this.steamLoading = true;
    this.userService.getSteamInventory().subscribe({
      next: (res) => {
        this.steamInventory = res;
        this.steamLoading = false;
        this.titles['cs2'] = ['CS2 & Steam', `Inventário sincronizado · ${res.count} itens` || 'Erro ao sincronizar'];
      },
      error: (err) => {
        this.steamError = err.error?.message || 'Erro ao ligar à Steam';
        this.steamLoading = false;
      }
    });
  }

  ngAfterViewInit() {
    if (this.chartCanvas) {
      setTimeout(() => this.drawPatrimonioChart(this.data['6m']), 100);
    }
  }

  showPage(name: string) {
    this.currentPage = name;
    if (name === 'dashboard' && this.chartCanvas) {
      setTimeout(() => this.drawPatrimonioChart(this.data[this.currentChartPeriod as keyof typeof this.data]), 50);
    }
    if (name === 'cs2') {
      setTimeout(() => {
        this.drawTrendChart();
        this.drawCompareChart();
      }, 50);
    }
  }

  setSteamTab(tab: string) {
    this.currentSteamTab = tab;
    if (tab === 'mercado') setTimeout(() => this.drawTrendChart(), 50);
    if (tab === 'comparativo') setTimeout(() => this.drawCompareChart(), 50);
    if (tab === 'roi') this.calcROI();
  }

  // ROI Methods
  onRoiItemChange(val: string) {
    const [sell, buy] = val.split(',').map(Number);
    this.roiCalc.buyPrice = buy;
    this.roiCalc.sellPrice = sell;
    this.calcROI();
  }

  calcROI() {
    const buy = this.roiCalc.buyPrice;
    const sell = this.roiCalc.sellPrice;
    const qty = this.roiCalc.qty;
    const dateVal = this.roiCalc.date;
    
    const days = dateVal ? Math.round((Date.now() - new Date(dateVal).getTime()) / (86400000)) : 180;
    const commission = sell * 0.15 * qty;
    const lucro = (sell - buy) * qty;
    const liquido = lucro - commission;
    const roi = buy > 0 ? ((sell - buy) / buy * 100) : 0;
    const anual = days > 0 ? ((Math.pow(1 + roi / 100, 365 / days) - 1) * 100) : 0;

    this.roiCalc.results = {
      lucro,
      liquido,
      roi,
      anual,
      dias: days,
      comissao: commission
    };
  }

  // Case Methods
  selectCase(name: string, price: string, ev: number) {
    const costNum = parseFloat(price.replace('€', '')) + 2.19;
    this.caseSim.selected = {
      name,
      price,
      ev,
      cost: Number(costNum.toFixed(2)),
      diff: Number((ev - costNum).toFixed(2))
    };
    this.caseSim.simResult = '';
  }

  simAberturas(n: number) {
    const ev = this.caseSim.selected.ev;
    const cost = this.caseSim.selected.cost;
    const gasto = (cost * n).toFixed(2);
    const esperado = (ev * n).toFixed(2);
    const diff = (ev * n - cost * n).toFixed(2);
    
    this.caseSim.simResult = `<strong>Simulação ${n} aberturas:</strong><br>Gasto: €${gasto} · Valor esperado: €${esperado} · <span style="color:var(--terra)">Perda esperada: -€${Math.abs(Number(diff))}</span>`;
  }

  // Charts
  private drawTrendChart() {
    if (!this.trendChartCanvas) return;
    this.drawChartGeneric(this.trendChartCanvas.nativeElement, [
      { data: [27.2, 26.8, 27.5, 28.1, 29.0, 30.2, 31.4, 30.8, 31.9, 33.2], color: '#c96a45' },
      { data: [52, 51.2, 53.4, 54.1, 55.8, 56.2, 57.4, 56.8, 57.9, 58.4], color: '#5f7e5f' },
      { data: [390, 392, 396, 401, 404, 406, 408, 409, 410, 412], color: '#8b80c8' },
    ], ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'].slice(0, 10), 160);
  }

  private drawCompareChart() {
    if (!this.compareChartCanvas) return;
    this.drawChartGeneric(this.compareChartCanvas.nativeElement, [
      { data: [120, 124, 132, 138, 142, 144], color: '#c9a84c' },
      { data: [120, 138, 156, 168, 184, 198], color: '#c96a45' },
      { data: [120, 122, 125, 128, 131, 134], color: '#5f7e5f' },
      { data: [120, 120.5, 121, 121.3, 121.5, 121.6], color: '#8a7a6a' },
    ], ['Nov 24', 'Dez 24', 'Jan 25', 'Fev 25', 'Mar 25', 'Abr 25'], 140);
  }

  private drawChartGeneric(canvas: HTMLCanvasElement, datasets: any[], labels: string[], height: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth;
    const H = height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const pad = { t: 10, r: 10, b: 22, l: 42 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
    const allV = datasets.flatMap(d => d.data);
    const mx = Math.max(...allV) * 1.02, mn = Math.min(...allV) * 0.98;
    const n = labels.length;
    const xOf = (i: number) => pad.l + (i / (n - 1)) * cW;
    const yOf = (v: number) => pad.t + cH - ((v - mn) / (mx - mn)) * cH;
    ctx.strokeStyle = 'rgba(90,74,58,0.07)'; ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const y = pad.t + (g / 3) * cH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
      const v = mx - (g / 3) * (mx - mn);
      ctx.fillStyle = 'rgba(138,122,106,0.65)'; ctx.font = '9px DM Sans'; ctx.textAlign = 'right';
      ctx.fillText(v >= 100 ? v.toFixed(0) : '€' + v.toFixed(0), pad.l - 4, y + 3);
    }
    labels.forEach((l, i) => { if (i % (Math.ceil(n / 6)) === 0 || i === n - 1) { ctx.fillStyle = 'rgba(138,122,106,0.65)'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center'; ctx.fillText(l, xOf(i), H - 4) } });
    datasets.forEach(({ data, color }) => {
      const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
      g.addColorStop(0, color + '28'); g.addColorStop(1, color + '04');
      ctx.beginPath(); data.forEach((v: any, i: any) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
      ctx.lineTo(xOf(n - 1), pad.t + cH); ctx.lineTo(xOf(0), pad.t + cH); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); data.forEach((v: any, i: any) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    });
  }

  openModal() {
    this.modalOpen = true;
  }

  saveSteamId(id: string) {
    if (!id) return;
    this.userService.updateExternalApis({ steamId: id }).subscribe({
      next: () => {
        this.closeModal();
        this.loadSteamInventory();
      }
    });
  }

  closeModal(e?: Event) {
    if (e) {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-overlay')) {
        this.modalOpen = false;
      }
    } else {
      this.modalOpen = false;
    }
  }

  updateChart(period: string) {
    this.currentChartPeriod = period;
    if (this.chartCanvas) {
      this.drawPatrimonioChart(this.data[period as keyof typeof this.data]);
    }
  }

  private drawPatrimonioChart(data6m: any) {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = 160;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, W, H);

    const pad = { t: 10, r: 10, b: 24, l: 50 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
    const datasets = [
      { data: data6m.networth, color: '#c96a45' },
      { data: data6m.etf, color: '#5f7e5f' },
      { data: data6m.rendas, color: '#8b80c8' },
    ];
    const allVals = datasets.flatMap(d => d.data);
    const maxV = Math.max(...allVals) || 1000; // Fallback to 1000 if empty/zero
    const minV = Math.min(...allVals) * 0.95;
    const n = data6m.networth.length;

    const xOf = (i: number) => pad.l + (i / (n - 1)) * cW;
    const yOf = (v: number) => pad.t + cH - ((v - minV) / (maxV - minV)) * cH;

    // Grid
    ctx.strokeStyle = 'rgba(90,74,58,0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 3; g++) {
      const y = pad.t + (g / 3) * cH;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + cW, y);
      ctx.stroke();
      const val = maxV - (g / 3) * (maxV - minV);
      ctx.fillStyle = 'rgba(138,122,106,0.7)';
      ctx.font = `9px DM Sans,sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('€' + (val / 1000).toFixed(0) + 'k', pad.l - 5, y + 3);
    }

    // X labels
    const months = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'];
    ctx.fillStyle = 'rgba(138,122,106,0.7)';
    ctx.textAlign = 'center';
    months.forEach((m, i) => {
      ctx.fillText(m, xOf(Math.round(i * (n - 1) / 6)), H - pad.b + 14);
    });

    // Lines
    datasets.forEach(ds => {
      // Area
      ctx.beginPath();
      ds.data.forEach((v: number, i: number) => {
        i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
      });
      ctx.lineTo(xOf(n - 1), pad.t + cH);
      ctx.lineTo(xOf(0), pad.t + cH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
      grad.addColorStop(0, ds.color + '30');
      grad.addColorStop(1, ds.color + '05');
      ctx.fillStyle = grad;
      ctx.fill();
      // Line
      ctx.beginPath();
      ds.data.forEach((v: number, i: number) => {
        i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
      });
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }

  setSimTab(tab: string) {
    this.currentSimTab = tab;
    this.simView = 'details';
    this.calcSimAll();
  }

  goBackToSimGrid() {
    this.simView = 'grid';
  }

  calcSimAll() {
    this.calcJuros();
    this.calcCH();
    this.calcFIRE();
  }

  calcJuros() {
    const p = this.simJuros.principal;
    const m = this.simJuros.monthly;
    const r = (this.simJuros.rate / 100) / 12;
    const n = this.simJuros.years * 12;

    if (r === 0) {
      this.simJuros.results.total = p + (m * n);
    } else {
      this.simJuros.results.total = p * Math.pow(1 + r, n) + m * ((Math.pow(1 + r, n) - 1) / r);
    }
    this.simJuros.results.invested = p + (m * n);
    this.simJuros.results.profit = this.simJuros.results.total - this.simJuros.results.invested;
  }

  calcCH() {
    const p = this.simCH.amount;
    const r = ((this.simCH.euribor + this.simCH.spread) / 100) / 12;
    const n = this.simCH.years * 12;

    if (r === 0) {
      this.simCH.results.prestacao = p / n;
    } else {
      const prestacao = p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      this.simCH.results.prestacao = prestacao;
    }
    this.simCH.results.totalJuros = (this.simCH.results.prestacao * n) - p;
  }

  calcFIRE() {
    const target = (this.simFIRE.gastos * 12) / 0.04; // Regra dos 4%
    this.simFIRE.results.target = target;
    
    let current = this.simFIRE.currentWealth;
    let years = 0;
    const r = this.simFIRE.return / 100;
    const savings = this.simFIRE.savings * 12;

    if (savings <= 0 && current < target && r <= 0) {
      this.simFIRE.results.yearsToFire = 99;
      return;
    }

    while (current < target && years < 100) {
      current = (current * (1 + r)) + savings;
      years++;
    }
    this.simFIRE.results.yearsToFire = years;
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    this.simFIRE.results.fireDate = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  }
}

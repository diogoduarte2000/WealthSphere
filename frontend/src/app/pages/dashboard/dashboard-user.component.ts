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
  isDark: boolean = true;
  
  userName: string = 'Utilizador';
  userInitial: string = 'U';
  userAvatar: string = '';
  userEmail: string = '';
  userSteamId: string = '';
  userSteamName: string = '';
  userSteamAvatar: string = '';

  // New Variables for Rendas Internal Tabs
  currentRendasTab: string = 'imoveis';

  titles: { [key: string]: [string, string] } = {
    dashboard: ['Dashboard', 'Domingo, 10 de Maio · Euribor 6M: 3.02% ↓'],
    income: ['Income Tracker', 'Maio 2025 · €1.920 de receitas'],
    taxas: ['Taxas & Mercados', 'Dados em tempo real · BCE · Banco de Portugal'],
    cs2: ['CS2 & Steam', 'Inventário sincronizado · 14 itens · €624'],
    comunidade: ['Comunidade', '487 membros ativos · 1.240 posts'],
    rendas: ['Rendas & Imóveis', '2 imóveis · €1.200/mês'],
    'add-renda': ['Adicionar Imóvel', 'Adiciona um novo ativo imobiliário à tua carteira'],
    simulador: ['Simulador', 'Juros compostos · FIRE · Amortizações'],
    perfil: ['Perfil', 'Lisboa 🇵🇹'],
    definicoes: ['Definições', 'Configura os teus rendimentos, despesas e chaves API'],
  };

  data: any = {
    '1d': { networth: [], etf: [], rendas: [], labels: [] },
    '1w': { networth: [], etf: [], rendas: [], labels: [] },
    '6m': { networth: [], etf: [], rendas: [], labels: [] },
    '1a': { networth: [], etf: [], rendas: [], labels: [] },
    '3a': { networth: [], etf: [], rendas: [], labels: [] },
    'max': { networth: [], etf: [], rendas: [], labels: [] }
  };

  financialData = {
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    etfPortfolio: 0,
    realEstateValue: 0,
    cryptoValue: 0
  };

  customSettings = {
    salary: 0,
    freelance: 0,
    supermarket: 0,
    electricity: 0,
    steamEarnings: 0
  };

  realEstate: any[] = [];
  t212Portfolio: any = null;

  savingSettings: boolean = false;
  
  newProperty: any = { name: '', dueDate: 1, rentAmount: 0, typology: 'T2', location: '', currentValue: 0, status: 'Arrendado', tenant: '', creditBank: '', creditPayment: 0, creditDebt: 0, creditSpread: 0 };
  newPropertyDateStr: string = new Date().toISOString().split('T')[0];
  propertyExpenses: { [propertyId: string]: { type: string, amount: number } } = {};

  // INE Calculator
  ineRendaAtual: number = 0;
  ineAno: string = '2025';
  ineNovaRenda: number = 0;
  ineAumento: number = 0;

  get totalRents(): number {
    return this.realEstate.reduce((sum: number, p: any) => sum + (p.rentAmount || 0), 0);
  }
  get totalPropertyValue(): number {
    return this.realEstate.reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0);
  }
  get totalCreditPayments(): number {
    return this.realEstate.reduce((sum: number, p: any) => sum + (p.credit?.monthlyPayment || 0), 0);
  }
  get totalDebt(): number {
    return this.realEstate.reduce((sum: number, p: any) => sum + (p.credit?.outstandingCapital || 0), 0);
  }
  get avgYield(): string {
    const yields = this.realEstate.filter((p: any) => p.currentValue > 0).map((p: any) => ((p.rentAmount || 0) * 12 / p.currentValue) * 100);
    if (yields.length === 0) return '0.0';
    return (yields.reduce((a: number, b: number) => a + b, 0) / yields.length).toFixed(1);
  }
  getRentYield(prop: any): string {
    if (!prop.currentValue || prop.currentValue === 0) return '0.0';
    return (((prop.rentAmount || 0) * 12 / prop.currentValue) * 100).toFixed(1);
  }
  getCapitalPaidPct(prop: any): number {
    if (!prop.credit) return 0;
    const total = (prop.credit.capitalPaid || 0) + (prop.credit.outstandingCapital || 0);
    if (total === 0) return 0;
    return (prop.credit.capitalPaid || 0) / total * 100;
  }
  hasAnyCredit(): boolean {
    return this.realEstate.some((p: any) => p.credit?.bank);
  }
  calcINE() {
    const coefs: any = { '2025': 2.16, '2024': 6.94, '2023': 2.00 };
    const coef = coefs[this.ineAno] || 2.16;
    this.ineNovaRenda = this.ineRendaAtual * (1 + coef / 100);
    this.ineAumento = this.ineNovaRenda - this.ineRendaAtual;
  }

  getPropertyExpense(propertyId: string) {
    if (!this.propertyExpenses[propertyId]) {
      this.propertyExpenses[propertyId] = { type: '', amount: 0 };
    }
    return this.propertyExpenses[propertyId];
  }

  financialModalOpen: boolean = false;
  nameModalOpen: boolean = false;
  t212ModalOpen: boolean = false;
  binanceModalOpen: boolean = false;
  deleteAccountStep: 'closed' | 'confirm' | 'type' = 'closed';
  
  savingFinancial: boolean = false;
  savingName: boolean = false;
  savingApis: boolean = false;
  deletingAccount: boolean = false;
  
  newDisplayName: string = '';
  t212ApiKey: string = '';
  binanceKey: string = '';
  deleteAccountInput: string = '';
  deleteAccountError: string = '';

  userT212Linked: boolean = false;
  userBinanceLinked: boolean = false;

  // Watchlist & Market State
  wlChartModalOpen: boolean = false;
  selectedWlItem: any = null;
  selectedWlTimeframe: string = '1m';
  wlSearchQuery: string = '';
  selectedMarketGameName: string = 'Counter-Strike 2';
  
  watchlistItems = [
    { emoji: '🗡️', name: 'Karambit | Fade FN', target: '€1.700', current: '€1.840', diff: '€140', isHit: false },
    { emoji: '🔵', name: 'AWP | Dragon Lore FT', target: '€2.000', current: '€1.980', diff: '✓', isHit: true },
    { emoji: '📦', name: 'Operation Bravo Case', target: '€40', current: '€44.50', diff: '€4.50', isHit: false }
  ];

  top10Items = [
    { name: 'AK-47 | Redline (FT)', price: '€33.20' },
    { name: 'AWP | Asiimov (FT)', price: '€58.40' },
    { name: 'Revolution Case', price: '€0.87' },
    { name: 'Recoil Case', price: '€0.64' },
    { name: 'Fracture Case', price: '€0.52' },
    { name: 'Dreams & Nightmares Case', price: '€0.81' },
    { name: 'Desert Eagle | Printstream (MW)', price: '€82.10' },
    { name: 'USP-S | Printstream (FT)', price: '€34.50' },
    { name: 'M4A1-S | Printstream (FT)', price: '€68.20' },
    { name: 'Glock-18 | Fade (FN)', price: '€1.240' }
  ];

  @ViewChild('wlDetailChart') wlDetailChartCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  steamInventory: any = null;
  steamLoading: boolean = false;
  steamError: string = '';
  currentSteamTab: string = 'inventario';
  steamSortOption: string = 'value_desc';
  
  // Skin Modal
  selectedSkin: any = null;
  skinModalOpen: boolean = false;

  // ROI Calculator
  roiCalc = {
    itemName: 'AK-47 | Redline (FT)',
    buyPrice: 27.20,
    sellPrice: 33.20,
    qty: 1,
    results: { lucro: 0, liquido: 0, roi: 0, dias: 0 }
  };

  // Case Simulator
  caseCategory: string = 'cases';
  caseSim: any = {
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

  /** Lê a preferência guardada no localStorage (dark é o padrão) */
  private loadTheme(): void {
    const saved = localStorage.getItem('ws-theme');
    this.isDark = saved ? saved !== 'light' : !this.isDaytime();
    this.applyTheme();
  }

  private isDaytime(): boolean {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 19;
  }

  /** Aplica o atributo data-theme ao <html> */
  private applyTheme(): void {
    const html = document.documentElement;
    if (this.isDark) {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', 'light');
    }
  }

  /** Alterna entre tema escuro e claro e guarda a preferência */
  toggleTheme(): void {
    this.isDark = !this.isDark;
    localStorage.setItem('ws-theme', this.isDark ? 'dark' : 'light');
    this.applyTheme();
  }

  ngOnInit() {
    this.loadTheme();
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

  openDeleteAccountConfirm(): void {
    this.deleteAccountStep = 'confirm';
    this.deleteAccountInput = '';
    this.deleteAccountError = '';
  }

  closeDeleteAccountModal(): void {
    if (this.deletingAccount) return;
    this.deleteAccountStep = 'closed';
    this.deleteAccountInput = '';
    this.deleteAccountError = '';
  }

  proceedDeleteAccount(): void {
    this.deleteAccountStep = 'type';
    this.deleteAccountInput = '';
    this.deleteAccountError = '';
  }

  confirmDeleteAccount(): void {
    if (this.deleteAccountInput.trim() !== 'delete') return;

    this.deletingAccount = true;
    this.deleteAccountError = '';
    this.userService.deleteAccount().subscribe({
      next: () => {
        localStorage.removeItem('wealthsphere_access_token');
        localStorage.removeItem('wealthsphere_refresh_token');
        localStorage.removeItem('wealthsphere_user');
        this.router.navigate(['/auth']);
      },
      error: (err) => {
        this.deletingAccount = false;
        this.deleteAccountError = err.error?.message || 'Erro ao eliminar conta.';
      }
    });
  }

  loginWithSteam() {
    const token = localStorage.getItem('wealthsphere_access_token');
    const linkUrl = `${environment.apiUrl}/auth/steam${token ? '?token=' + token : ''}`;
    window.location.href = linkUrl;
  }

  unlinkSteam() {
    console.log('Unlink Steam clicked');
    if (!confirm('Tens a certeza que queres desassociar a tua conta Steam?')) return;

    this.steamLoading = true;
    this.userService.unlinkSteam().subscribe({
      next: (res) => {
        console.log('Unlink success:', res);
        this.steamInventory = null;
        this.steamError = '';
        this.userSteamId = '';
        this.userSteamName = '';
        this.userSteamAvatar = '';
        this.titles['cs2'] = ['CS2 & Steam', 'Sincroniza o teu inventário'];
        
        // Atualizar storage
        const userStr = localStorage.getItem('wealthsphere_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            delete user.steamId;
            delete user.steamName;
            delete user.steamAvatar;
            localStorage.setItem('wealthsphere_user', JSON.stringify(user));
          } catch (e) {
            console.error('Error updating storage', e);
          }
        }

        alert('Conta Steam desassociada com sucesso.');
        this.steamLoading = false;
        // Atualizar perfil para refletir mudanças na UI
        this.loadProfile();
      },
      error: (err) => {
        console.error('Unlink error:', err);
        this.steamLoading = false;
        alert('Erro ao desassociar conta: ' + (err.error?.message || 'Erro desconhecido'));
      }
    });
  }

  loadProfile() {
    this.userService.getProfile().subscribe({
      next: (res) => {
        const user = res.profile;
        this.userName = user.displayName || user.name || 'Utilizador';
        this.userEmail = user.email || '';
        this.userAvatar = user.avatar || '';
        this.userInitial = this.userName.charAt(0).toUpperCase();
        this.newDisplayName = this.userName;
        this.userSteamId = user.steamId || '';
        this.userSteamName = user.steamName || '';
        this.userSteamAvatar = user.steamAvatar || '';
        
        this.t212ApiKey = '';
        this.binanceKey = '';
        this.userT212Linked = !!user.hasTrading212ApiKey;
        this.userBinanceLinked = !!user.hasBinanceApiKey;

        if (user.financialProfile) {
          this.financialData = {
            netWorth: user.financialProfile.netWorth || 0,
            monthlyIncome: user.financialProfile.monthlyIncome || 0,
            monthlyExpenses: user.financialProfile.monthlyExpenses || 0,
            etfPortfolio: user.financialProfile.etfPortfolio || 0,
            realEstateValue: user.financialProfile.realEstateValue || 0,
            cryptoValue: user.financialProfile.cryptoValue || 0
          };

          if (user.customSettings) {
            this.customSettings = {
              salary: user.customSettings.salary || 0,
              freelance: user.customSettings.freelance || 0,
              supermarket: user.customSettings.supermarket || 0,
              electricity: user.customSettings.electricity || 0,
              steamEarnings: user.customSettings.steamEarnings || 0
            };
          }

          if (user.realEstate) {
            this.realEstate = user.realEstate;
          }

          // Generate dynamic chart data based on live loaded assets
          this.generateChartData();

          if (this.currentPage === 'dashboard') {
            setTimeout(() => this.drawPatrimonioChart(this.data[this.currentChartPeriod]), 100);
          }
        }
        
        // Sincronizar local storage com dados frescos
        localStorage.setItem('wealthsphere_user', JSON.stringify(user));

        if (user.steamId) {
          this.loadSteamInventory();
        }
        if (this.userT212Linked) {
          this.loadT212Portfolio();
        }
      }
    });
  }

  saveCustomSettings() {
    this.savingSettings = true;
    this.userService.updateCustomSettings(this.customSettings).subscribe({
      next: (res) => {
        this.savingSettings = false;
        alert('Definições atualizadas com sucesso!');
        this.loadProfile();
      },
      error: (err) => {
        this.savingSettings = false;
        alert('Erro ao atualizar definições: ' + (err.error?.message || err.message));
      }
    });
  }

  addRealEstateProperty() {
    if (!this.newProperty.name || this.newProperty.rentAmount <= 0) return;
    
    // Extrai o dia do mês selecionado no calendário
    if (this.newPropertyDateStr) {
      const selectedDate = new Date(this.newPropertyDateStr);
      // Garantir que a data é válida
      if (!isNaN(selectedDate.getTime())) {
        this.newProperty.dueDate = selectedDate.getDate();
      }
    }

    // Build property with credit sub-object
    const propToSend: any = {
      name: this.newProperty.name,
      dueDate: this.newProperty.dueDate,
      rentAmount: this.newProperty.rentAmount,
      typology: this.newProperty.typology,
      location: this.newProperty.location,
      currentValue: this.newProperty.currentValue,
      status: this.newProperty.status,
      contract: { tenant: this.newProperty.tenant, dueDate: this.newProperty.dueDate, frequency: 'Mensal' },
      expenses: []
    };
    if (this.newProperty.creditBank) {
      propToSend.credit = {
        bank: this.newProperty.creditBank,
        monthlyPayment: this.newProperty.creditPayment || 0,
        outstandingCapital: this.newProperty.creditDebt || 0,
        capitalPaid: 0,
        spread: this.newProperty.creditSpread || 0
      };
    }
    this.userService.updateRealEstate({ action: 'addProperty', property: propToSend }).subscribe({
      next: (res) => {
        this.newProperty = { name: '', dueDate: 1, rentAmount: 0, typology: 'T2', location: '', currentValue: 0, status: 'Arrendado', tenant: '', creditBank: '', creditPayment: 0, creditDebt: 0, creditSpread: 0 };
        this.newPropertyDateStr = new Date().toISOString().split('T')[0];
        this.currentPage = 'rendas';
        this.loadProfile();
      }
    });
  }

  deleteRealEstateProperty(propertyId: string) {
    if (!confirm('Eliminar este imóvel?')) return;
    this.userService.updateRealEstate({ action: 'deleteProperty', propertyId }).subscribe({
      next: (res) => {
        this.loadProfile();
      }
    });
  }

  addRealEstateExpense(propertyId: string) {
    const expenseData = this.getPropertyExpense(propertyId);
    if (!expenseData.type || expenseData.amount <= 0) return;

    const payload = {
      propertyId,
      type: expenseData.type,
      amount: expenseData.amount,
      date: new Date().toISOString().split('T')[0]
    };

    this.userService.updateRealEstate({ action: 'addExpense', propertyId, expense: payload }).subscribe({
      next: (res) => {
        this.propertyExpenses[propertyId] = { type: '', amount: 0 };
        this.loadProfile();
      }
    });
  }

  deleteRealEstateExpense(propertyId: string, expenseId: string) {
    if (!confirm('Eliminar esta despesa?')) return;
    this.userService.updateRealEstate({ action: 'deleteExpense', propertyId, expenseId }).subscribe({
      next: (res) => {
        this.loadProfile();
      }
    });
  }

  loadT212Portfolio() {
    this.userService.getT212Portfolio().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.t212Portfolio = res.data;
          this.generateChartData();
          if (this.currentPage === 'dashboard') {
            this.drawPatrimonioChart(this.data[this.currentChartPeriod]);
          }
        }
      },
      error: (err) => {
        console.error('Error loading Trading212 portfolio:', err);
      }
    });
  }

  openFinancialModal() {
    this.financialModalOpen = true;
  }

  closeFinancialModal() {
    this.financialModalOpen = false;
  }

  openNameModal() {
    this.newDisplayName = this.userName;
    this.nameModalOpen = true;
  }

  closeNameModal() {
    this.nameModalOpen = false;
  }

  saveName() {
    if (!this.newDisplayName || !this.newDisplayName.trim()) return;
    console.log('Saving new display name:', this.newDisplayName);
    this.savingName = true;
    this.userService.updateProfile({ displayName: this.newDisplayName }).subscribe({
      next: (res) => {
        console.log('Profile update success:', res);
        this.savingName = false;
        this.closeNameModal();
        this.loadProfile();
        alert('Nome atualizado com sucesso!');
      },
      error: (err) => {
        console.error('Profile update error:', err);
        this.savingName = false;
        alert('Erro ao atualizar nome: ' + (err.error?.message || err.message));
      }
    });
  }

  openT212Modal() {
    this.t212ModalOpen = true;
  }

  closeT212Modal() {
    this.t212ModalOpen = false;
  }

  saveT212() {
    if (!this.t212ApiKey.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ trading212ApiKey: this.t212ApiKey }).subscribe({
      next: (res) => {
        this.savingApis = false;
        this.closeT212Modal();
        this.loadProfile();
        alert('API Trading 212 ligada com sucesso!');
      },
      error: (err) => {
        this.savingApis = false;
        alert('Erro ao ligar API: ' + (err.error?.message || err.message));
      }
    });
  }

  get totalIncome() {
    let rentTotal = 0;
    this.realEstate.forEach(r => rentTotal += (r.rentAmount || 0));
    return (this.customSettings.salary || 0) + 
           (this.customSettings.freelance || 0) + 
           (this.customSettings.steamEarnings || 0) + 
           rentTotal;
  }


  get totalETF() {
    const t212 = this.t212Portfolio && this.t212Portfolio.total ? this.t212Portfolio.total : 0;
    return (this.financialData.etfPortfolio || 0) + t212;
  }

  get calculatedNetWorth() {
    const cash = this.financialData.netWorth || 0; // Dinheiro em Conta
    const etf = this.totalETF || 0;
    const crypto = this.financialData.cryptoValue || 0;
    const realEstate = this.financialData.realEstateValue || 0;
    const cs2 = this.steamInventoryTotalValue || 0;
    
    return cash + etf + crypto + realEstate + cs2;
  }

  generateChartData() {
    const networthVal = this.calculatedNetWorth;
    const etfVal = this.totalETF;
    const rendasVal = this.financialData.realEstateValue || 0;

    const makeCurve = (len: number, finalVal: number, baselinePercent: number = 0.85) => {
      if (finalVal <= 0) return Array(len).fill(0);
      const points = [];
      for (let i = 0; i < len; i++) {
        if (i === len - 1) {
          points.push(finalVal);
        } else {
          const ratio = i / (len - 1);
          const growth = baselinePercent + (1.0 - baselinePercent) * ratio;
          const noise = 1 + (Math.sin(ratio * 10) * 0.01) + ((Math.sin(i * 99) % 1) * 0.005);
          points.push(Number((finalVal * growth * noise).toFixed(2)));
        }
      }
      return points;
    };

    // 1D (Hoje) - 8 points (hourly)
    this.data['1d'] = {
      networth: makeCurve(8, networthVal, 0.99),
      etf: makeCurve(8, etfVal, 0.99),
      rendas: Array(8).fill(rendasVal),
      labels: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00']
    };

    // 1W (1 Semana) - 7 days
    this.data['1w'] = {
      networth: makeCurve(7, networthVal, 0.98),
      etf: makeCurve(7, etfVal, 0.97),
      rendas: makeCurve(7, rendasVal, 1.0),
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    };

    // 6M (6 Meses) - 7 months
    this.data['6m'] = {
      networth: makeCurve(7, networthVal, 0.88),
      etf: makeCurve(7, etfVal, 0.82),
      rendas: makeCurve(7, rendasVal, 0.95),
      labels: ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
    };

    // 1A (1 Ano) - 12 months
    this.data['1a'] = {
      networth: makeCurve(12, networthVal, 0.78),
      etf: makeCurve(12, etfVal, 0.68),
      rendas: makeCurve(12, rendasVal, 0.90),
      labels: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
    };

    // 3A (3 Anos) - 24 points (bi-monthly approx)
    this.data['3a'] = {
      networth: makeCurve(24, networthVal, 0.55),
      etf: makeCurve(24, etfVal, 0.40),
      rendas: makeCurve(24, rendasVal, 0.75),
      labels: ['2024 Q1', 'Q2', 'Q3', 'Q4', '2025 Q1', 'Q2', 'Q3', 'Q4', '2026 Q1', 'Q2']
    };

    // MAX (Máximo) - 36 points
    this.data['max'] = {
      networth: makeCurve(36, networthVal, 0.35),
      etf: makeCurve(36, etfVal, 0.20),
      rendas: makeCurve(36, rendasVal, 0.60),
      labels: ['2023', '2024', '2025', '2026']
    };
  }

  get totalExpenses() {
    let propExpTotal = 0;
    this.realEstate.forEach(r => {
      if (r.expenses) {
        r.expenses.forEach((e: any) => propExpTotal += (e.amount || 0));
      }
    });
    return (this.customSettings.supermarket || 0) + 
           (this.customSettings.electricity || 0) + 
           propExpTotal;
  }

  get totalSavings() {
    return this.totalIncome - this.totalExpenses;
  }

  get nextRentInfo() {
    if (this.realEstate.length === 0) return { amount: 0, desc: 'Nenhuma' };
    
    // Simplification for the closest due date
    const today = new Date().getDate();
    let closest = this.realEstate[0];
    let minDiff = 31;
    
    for (let r of this.realEstate) {
      let diff = r.dueDate - today;
      if (diff < 0) diff += 30; // next month
      if (diff < minDiff) {
        minDiff = diff;
        closest = r;
      }
    }
    
    return { amount: closest.rentAmount, desc: `${closest.dueDate} deste mês · ${closest.name}` };
  }

  openBinanceModal() {
    this.binanceModalOpen = true;
  }

  closeBinanceModal() {
    this.binanceModalOpen = false;
  }

  saveBinance() {
    if (!this.binanceKey.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ 
      binanceApiKey: this.binanceKey
    }).subscribe({
      next: (res) => {
        this.savingApis = false;
        this.closeBinanceModal();
        this.loadProfile();
        alert('API Binance ligada com sucesso!');
      },
      error: (err) => {
        this.savingApis = false;
        alert('Erro ao ligar API: ' + (err.error?.message || err.message));
      }
    });
  }

  saveFinancialData() {
    this.savingFinancial = true;
    this.userService.updateFinancialData(this.financialData).subscribe({
      next: (res) => {
        this.savingFinancial = false;
        this.closeFinancialModal();
        this.loadProfile(); // Recarregar dados
        alert('Dados atualizados com sucesso!');
      },
      error: (err) => {
        this.savingFinancial = false;
        alert('Erro ao guardar dados: ' + (err.error?.message || err.message));
      }
    });
  }

  loadSteamInventory() {
    this.steamLoading = true;
    this.userService.getSteamInventory().subscribe({
      next: (res) => {
        console.log('Steam inventory response:', res);
        if (res.items) {
          res.items.forEach((item: any) => {
            const hash = item.name.split('').reduce((a: number, b: string) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
            
            // Simulate stable 24h price variation (-8.5% to +12.5%) for all items
            const varHash = Math.abs(hash + 42);
            item.mockVariation = ((varHash % 210) / 10) - 8.5;
            
            // Simulate daily volume for investors info
            item.mockVolume = (Math.abs(hash + 100) % 500) + 15;
          });
        }
        this.steamInventory = res;
        this.steamLoading = false;
        console.log('Steam inventory set:', this.steamInventory);
        
        // Backend já retorna preços automaticamente, não precisa buscar no frontend
        this.generateChartData();
        if (this.currentPage === 'dashboard') {
          this.drawPatrimonioChart(this.data[this.currentChartPeriod]);
        }
      },
      error: (err) => {
        console.error('Steam inventory error:', err);
        this.steamError = err.error?.message || 'Erro ao ligar à Steam';
        this.steamLoading = false;
      }
    });
  }

  get sortedSteamInventory() {
    if (!this.steamInventory || !this.steamInventory.items) return [];
    let items = [...this.steamInventory.items];
    if (this.steamSortOption === 'value_desc') {
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (this.steamSortOption === 'value_asc') {
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (this.steamSortOption === 'rarity') {
      // Ordenação simples por raridade baseada na cor (ex: Vermelho > Rosa > Roxo > Azul)
      const rarityWeight: {[key: string]: number} = {
        'eb4b4b': 5, // Covert (Red)
        'd32ce6': 4, // Classified (Pink)
        '8847ff': 3, // Restricted (Purple)
        '4b69ff': 2, // Mil-Spec (Blue)
        '5e98d9': 1, // Industrial (Light Blue)
        'b0c3d9': 0  // Consumer (White)
      };
      items.sort((a, b) => {
        const wA = rarityWeight[a.color?.toLowerCase()] || 0;
        const wB = rarityWeight[b.color?.toLowerCase()] || 0;
        return wB - wA;
      });
    }
    return items;
  }

  get steamInventoryTotalValue() {
    if (!this.steamInventory || !this.steamInventory.items) return 0;
    return this.steamInventory.items.reduce((acc: number, item: any) => acc + (item.price || 0), 0);
  }

  get biggestSteamItem() {
    if (!this.steamInventory || !this.steamInventory.items || this.steamInventory.items.length === 0) return null;
    let items = [...this.steamInventory.items];
    items.sort((a, b) => (b.price || 0) - (a.price || 0));
    return items[0];
  }

  // --- Skin Modal Methods ---
  openSkinModal(skin: any) {
    this.selectedSkin = skin;
    this.skinModalOpen = true;
  }

  closeSkinModal() {
    this.skinModalOpen = false;
    this.selectedSkin = null;
  }

  // --- Real Estate Methods ---
  ngAfterViewInit() {
    if (this.chartCanvas) {
      setTimeout(() => this.drawPatrimonioChart(this.data[this.currentChartPeriod]), 100);
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
    const lucroTotal = (sell - buy) * qty;
    const liquidoTotal = lucroTotal - (sell * 0.15 * qty);
    const roi = buy > 0 ? ((sell - buy) / buy * 100) : 0;

    this.roiCalc.results = {
      lucro: lucroTotal,
      liquido: liquidoTotal,
      roi,
      dias: 30
    };
  }

  // Case Methods
  selectCase(name: string, price: string, ev: number) {
    const costNum = parseFloat(price.replace('€', '')) + 2.19;
    this.caseSim.selected = {
      name,
      price: '€' + costNum.toFixed(2),
      ev: '€' + ev.toFixed(2)
    };
    this.caseSim.simResult = '';
  }

  simAberturas(qtd: number) {
    const totalCost = (parseFloat(this.caseSim.selected.cost.replace('€','')) * qtd);
    let totalReturn = 0;
    let blues = 0, purples = 0, reds = 0;

    for (let i = 0; i < qtd; i++) {
      const rand = Math.random() * 100;
      if (rand < 0.64) { reds++; totalReturn += 150 + Math.random() * 500; }
      else if (rand < 16) { purples++; totalReturn += 5 + Math.random() * 25; }
      else { blues++; totalReturn += 0.1 + Math.random() * 2; }
    }

    const profit = totalReturn - totalCost;
    this.caseSim.simResult = `
      <b>Resultado da Simulação (${qtd} aberturas):</b><br>
      Total Gasto: <span style="color:var(--ink)">€${totalCost.toFixed(2)}</span><br>
      Total Ganho: <span style="color:${totalReturn > totalCost ? 'var(--sage)' : 'var(--terra)'}">€${totalReturn.toFixed(2)}</span><br>
      Balanço: <span style="font-weight:700; color:${profit > 0 ? 'var(--sage)' : 'var(--terra)'}">€${profit.toFixed(2)}</span><br><br>
      <small>Drops: ${reds} Vermelhos (Covert), ${purples} Roxos (Restricted), ${blues} Azuis (Mil-spec)</small>
    `;
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
    const labels = data6m.labels || [];
    ctx.fillStyle = 'rgba(138,122,106,0.7)';
    ctx.textAlign = 'center';
    const totalLabels = labels.length;
    
    // Draw up to 7 labels to fit nicely without overlapping
    const maxLabelsToShow = Math.min(totalLabels, 7);
    for (let k = 0; k < maxLabelsToShow; k++) {
      const idx = Math.round(k * (totalLabels - 1) / (maxLabelsToShow - 1));
      if (idx >= 0 && idx < totalLabels) {
        ctx.fillText(labels[idx], xOf(idx), H - pad.b + 14);
      }
    }

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
  setCaseCategory(cat: string) {
    this.caseCategory = cat;
    this.caseSim.simResult = '';
    // Select default item for the category
    if (cat === 'cases') this.selectCase('Kilowatt Case','€1.20',1.85);
    else if (cat === 'capsules') this.selectCase('Paris 2023 Legends','€0.24',0.12);
    else if (cat === 'terminals') this.selectCase('Armory Pass Item','€1.50',0.90);
  }

  selectMarketGame(event: any) {
    const game = event.target.value;
    const gameNames: any = {
      'cs2': 'Counter-Strike 2',
      'dota2': 'Dota 2',
      'rust': 'Rust',
      'tf2': 'Team Fortress 2'
    };
    this.selectedMarketGameName = gameNames[game];
    
    // Mock update top 10 items based on game
    if (game === 'cs2') {
      this.top10Items = [
        { name: 'AK-47 | Redline (FT)', price: '€33.20' },
        { name: 'AWP | Asiimov (FT)', price: '€58.40' },
        { name: 'Revolution Case', price: '€0.87' }
      ];
    } else if (game === 'dota2') {
      this.top10Items = [
        { name: 'Dragonclaw Hook', price: '€142.10' },
        { name: 'Mace of Aeons', price: '€210.50' },
        { name: 'Arcana Bundle', price: '€28.40' }
      ];
    } else {
      this.top10Items = [
        { name: 'Item Popular 1', price: '€12.50' },
        { name: 'Item Popular 2', price: '€8.20' },
        { name: 'Item Popular 3', price: '€4.10' }
      ];
    }
  }

  addToWatchlist() {
    if (!this.wlSearchQuery.trim()) return;
    this.watchlistItems.unshift({
      emoji: '🔍',
      name: this.wlSearchQuery,
      target: '€0.00',
      current: '€' + (Math.random() * 100).toFixed(2),
      diff: 'Pendente',
      isHit: false
    });
    this.wlSearchQuery = '';
    alert('Item adicionado à Watchlist!');
  }

  openWatchlistChart(item: any) {
    this.selectedWlItem = item;
    this.wlChartModalOpen = true;
    setTimeout(() => this.drawWlDetailChart(), 100);
  }

  closeWlChart() {
    this.wlChartModalOpen = false;
    this.selectedWlItem = null;
  }

  setWlTimeframe(t: string) {
    this.selectedWlTimeframe = t;
    this.drawWlDetailChart();
  }

  drawWlDetailChart() {
    if (!this.wlDetailChartCanvas) return;
    const ctx = this.wlDetailChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Simulate different data based on timeframe
    const labels = this.selectedWlTimeframe === '24h' ? ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'] : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'];
    const data = Array(labels.length).fill(0).map(() => 100 + Math.random() * 50);

    // Clear and draw (Using simple line for now as Chart.js is not imported globally in this context, 
    // but assuming user has it or we use raw Canvas as in previous examples)
    ctx.clearRect(0, 0, 400, 400);
    ctx.beginPath();
    ctx.strokeStyle = '#df6b45';
    ctx.lineWidth = 3;
    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * 800;
      const y = 400 - (val / 200) * 400;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

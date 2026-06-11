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
  @ViewChild('chartTooltip', { static: false }) chartTooltip!: ElementRef<HTMLDivElement>;
  private chartCurrentData: any = null;
  private chartMouseHandler: ((e: MouseEvent) => void) | null = null;
  private chartLeaveHandler: (() => void) | null = null;

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
    investimentos: ['Investimentos', 'Portfólio Trading 212 · Pesquisar ações'],
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
  t212History: any[] = [];
  t212HistoryDays: number = 90;
  @ViewChild('t212ChartCanvas') t212ChartCanvas: any;
  @ViewChild('t212Tooltip') t212TooltipEl: any;
  private t212MouseHandler: ((e: MouseEvent) => void) | null = null;
  private t212LeaveHandler: (() => void) | null = null;

  get t212HistoryGain(): number {
    if (this.t212History.length < 2) return 0;
    return (this.t212History[this.t212History.length - 1]?.total || 0) - (this.t212History[0]?.total || 0);
  }

  get t212HistoryGainPct(): number {
    const first = this.t212History[0]?.total || 0;
    if (first === 0) return 0;
    return (this.t212HistoryGain / first) * 100;
  }

  loadT212History() {
    this.userService.getT212History(this.t212HistoryDays).subscribe({
      next: (data: any) => {
        const real = data.snapshots || [];
        if (real.length < 2) {
          // Generate demo curve based on current portfolio value
          const base = this.t212Portfolio?.data?.total || 0;
          const inv  = this.t212Portfolio?.data?.invested || 0;
          if (base > 0) {
            const days = this.t212HistoryDays;
            const pts = Math.min(days, 30);
            const now = new Date();
            this.t212History = Array.from({ length: pts }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (pts - 1 - i));
              const ratio = (i / (pts - 1));
              const noise = 1 + (Math.sin(i * 2.7) * 0.008) + (Math.sin(i * 5.1) * 0.004);
              const growth = 0.92 + 0.08 * ratio;
              return {
                date: d.toISOString().slice(0, 10),
                total: +(base * growth * noise).toFixed(2),
                invested: inv > 0 ? +(inv * (0.90 + 0.10 * ratio)).toFixed(2) : 0,
                source: 'demo'
              };
            });
            this.t212History[pts - 1].total = base;
            if (inv > 0) this.t212History[pts - 1].invested = inv;
          } else {
            this.t212History = real;
          }
        } else {
          this.t212History = real;
        }
        setTimeout(() => this.drawT212Chart(), 50);
      },
      error: () => {}
    });
  }

  drawT212Chart() {
    if (!this.t212ChartCanvas || this.t212History.length < 2) return;
    const canvas = this.t212ChartCanvas.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 800;
    const H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { t: 14, b: 28, l: 54, r: 16 };
    const data = this.t212History;
    const n = data.length;
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    const totalVals = data.map((s: any) => s.total || 0);
    const investedVals = data.map((s: any) => s.invested || 0);
    const allVals = [...totalVals, ...investedVals.filter((v: number) => v > 0)];
    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const range = rawMax - rawMin || 1;
    const minV = rawMin - range * 0.04;
    const maxV = rawMax + range * 0.08;

    const xOf = (i: number) => pad.l + (i / Math.max(n - 1, 1)) * cW;
    const yOf = (v: number) => pad.t + cH - ((v - minV) / (maxV - minV)) * cH;
    const color = this.t212HistoryGain >= 0 ? '#4a9e6b' : '#c97b6a';

    const smoothPath = (pts: [number, number][]) => {
      if (pts.length < 2) return;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const t = 0.18;
        ctx.bezierCurveTo(
          p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
          p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t,
          p2[0], p2[1]
        );
      }
    };

    const redraw = (hoverIdx: number | null) => {
      ctx.clearRect(0, 0, W, H);

      // Grid
      for (let g = 0; g <= 4; g++) {
        const y = pad.t + (g / 4) * cH;
        const v = maxV - (g / 4) * (maxV - minV);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
        ctx.fillStyle = 'rgba(180,160,130,0.55)';
        ctx.font = '10px DM Sans,sans-serif';
        ctx.textAlign = 'right';
        const lbl = v >= 1000 ? '€' + (v / 1000).toFixed(1) + 'k' : '€' + v.toFixed(0);
        ctx.fillText(lbl, pad.l - 5, y + 3.5);
      }

      // X date labels (first + last + ~4 middle)
      const dates = data.map((s: any) => (s.date || '').slice(5)); // MM-DD
      const show = Math.min(n, 5);
      ctx.fillStyle = 'rgba(180,160,130,0.55)';
      ctx.font = '10px DM Sans,sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < show; k++) {
        const idx = Math.round(k * (n - 1) / Math.max(show - 1, 1));
        ctx.fillText(dates[idx], xOf(idx), H - 5);
      }

      // Invested area (dashed line, subtle)
      const hasInvested = investedVals.some((v: number) => v > 0);
      if (hasInvested) {
        const ipts: [number, number][] = investedVals.map((v: number, i: number) => [xOf(i), yOf(v)]);
        ctx.beginPath();
        smoothPath(ipts);
        ctx.strokeStyle = 'rgba(201,168,76,0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Total area fill
      const tpts: [number, number][] = totalVals.map((v: number, i: number) => [xOf(i), yOf(v)]);
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
      grad.addColorStop(0, color + '30');
      grad.addColorStop(1, color + '03');
      ctx.beginPath();
      smoothPath(tpts);
      ctx.lineTo(xOf(n - 1), pad.t + cH);
      ctx.lineTo(xOf(0), pad.t + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Total line
      ctx.beginPath();
      smoothPath(tpts);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();

      // End dot
      const last = tpts[tpts.length - 1];
      ctx.beginPath();
      ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hover crosshair
      if (hoverIdx !== null) {
        const xPos = xOf(hoverIdx);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xPos, pad.t); ctx.lineTo(xPos, pad.t + cH); ctx.stroke();
        ctx.setLineDash([]);
        // Dot on total line
        ctx.beginPath();
        ctx.arc(xPos, yOf(totalVals[hoverIdx]), 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Dot on invested line
        if (hasInvested && investedVals[hoverIdx] > 0) {
          ctx.beginPath();
          ctx.arc(xPos, yOf(investedVals[hoverIdx]), 4, 0, Math.PI * 2);
          ctx.fillStyle = '#c9a84c'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    };

    redraw(null);

    // Hover tooltip
    const tooltip = this.t212TooltipEl?.nativeElement;
    if (!tooltip) return;
    if (this.t212MouseHandler) canvas.removeEventListener('mousemove', this.t212MouseHandler);
    if (this.t212LeaveHandler) canvas.removeEventListener('mouseleave', this.t212LeaveHandler);

    this.t212MouseHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      if (mx < pad.l || mx > pad.l + cW) { tooltip.style.display = 'none'; redraw(null); return; }
      const idx = Math.min(Math.max(Math.round((mx - pad.l) / cW * (n - 1)), 0), n - 1);
      redraw(idx);

      const s = data[idx];
      const gain = s.total - (data[0]?.total || 0);
      const gainSign = gain >= 0 ? '+' : '';
      const invLine = s.invested > 0
        ? `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:8px;height:8px;border-radius:50%;background:#c9a84c;display:inline-block"></span><span style="color:rgba(200,180,150,0.7);min-width:64px">Investido</span><span style="font-weight:600;color:#e8d5b0">€${s.invested.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>` : '';
      tooltip.innerHTML = `
        <div style="font-weight:700;color:#c9a84c;margin-bottom:6px;font-size:11px">${s.date || ''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
          <span style="color:rgba(200,180,150,0.7);min-width:64px">Total</span>
          <span style="font-weight:600;color:#e8d5b0">€${s.total.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        ${invLine}
        <div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(201,168,76,0.15);font-size:10px" [style.color]="gain >= 0 ? '#4a9e6b' : '#c97b6a'">
          <span style="color:${gain >= 0 ? '#4a9e6b' : '#c97b6a'}">${gainSign}€${gain.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})} vs início</span>
        </div>`;
      tooltip.style.display = 'block';
      const ttW = 210;
      let left = xOf(idx) + 12;
      if (left + ttW > W - 8) left = xOf(idx) - ttW - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = Math.max(pad.t, Math.min(e.clientY - rect.top - 20, H - 100)) + 'px';
    };
    this.t212LeaveHandler = () => { tooltip.style.display = 'none'; redraw(null); };
    canvas.addEventListener('mousemove', this.t212MouseHandler);
    canvas.addEventListener('mouseleave', this.t212LeaveHandler);
  }

  savingSettings: boolean = false;

  // App settings
  appTheme: string = localStorage.getItem('ws_theme') || 'dark';
  appLanguage: string = localStorage.getItem('ws_language') || 'pt';
  // ── Notification / Price Alerts ──
  notifOpen: boolean = false;
  notifications: any[] = [];
  unreadNotifs: number = 0;
  priceAlerts: any[] = JSON.parse(localStorage.getItem('ws_price_alerts') || '[]');
  alertModalOpen: boolean = false;
  alertTargetItem: any = null;
  alertTargetPrice: number = 0;

  get unreadAlerts() { return this.priceAlerts.filter(a => a.triggered); }

  openAlertModal(item: any) {
    this.alertTargetItem = item;
    const existing = this.priceAlerts.find(a => a.itemName === item.name);
    this.alertTargetPrice = existing ? existing.targetPrice : (item.price ? +(item.price * 0.9).toFixed(2) : 0);
    this.alertModalOpen = true;
  }

  hasAlert(itemName: string): boolean {
    return this.priceAlerts.some(a => a.itemName === itemName);
  }

  getAlert(itemName: string): any {
    return this.priceAlerts.find(a => a.itemName === itemName) || null;
  }

  skinAlertTarget: number = 0;

  saveSkinAlertFromModal() {
    if (!this.selectedSkin || !this.skinAlertTarget || this.skinAlertTarget <= 0) return;
    const existing = this.priceAlerts.findIndex(a => a.itemName === this.selectedSkin.name);
    const entry = { itemName: this.selectedSkin.name, targetPrice: +this.skinAlertTarget, currentPrice: this.selectedSkin.price, triggered: false };
    if (existing >= 0) { this.priceAlerts[existing] = entry; }
    else { this.priceAlerts.push(entry); }
    localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
    this.skinAlertTarget = 0;
  }

  removeAlertByName(itemName: string) {
    this.priceAlerts = this.priceAlerts.filter(a => a.itemName !== itemName);
    localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
  }

  saveAlert() {
    const existing = this.priceAlerts.findIndex(a => a.itemName === this.alertTargetItem?.name);
    const entry = { itemName: this.alertTargetItem.name, targetPrice: +this.alertTargetPrice, currentPrice: this.alertTargetItem.price, triggered: false };
    if (existing >= 0) { this.priceAlerts[existing] = entry; }
    else { this.priceAlerts.push(entry); }
    localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
    this.alertModalOpen = false;
  }

  removeAlert(alert: any) {
    this.priceAlerts = this.priceAlerts.filter(a => a.itemName !== alert.itemName);
    localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
  }

  checkAlertPrices() {
    if (!this.priceAlerts.length) return;
    const token = localStorage.getItem('wealthsphere_access_token');
    this.priceAlerts.forEach(alert => {
      fetch(`${environment.apiUrl}/external/steam/price?name=${encodeURIComponent(alert.itemName)}&game=cs2`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      .then(r => r.json())
      .then(data => {
        if (data.price != null) {
          alert.currentPrice = data.price;
          alert.triggered = data.price <= alert.targetPrice;
        }
        localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
      })
      .catch(() => {});
    });
  }

  notifEuribor: boolean = localStorage.getItem('ws_notif_euribor') !== 'false';
  notifRent: boolean = localStorage.getItem('ws_notif_rent') !== 'false';
  notifForum: boolean = localStorage.getItem('ws_notif_forum') !== 'false';
  privacyShowWealth: boolean = localStorage.getItem('ws_privacy_wealth') !== 'false';
  privacyPublicProfile: boolean = localStorage.getItem('ws_privacy_profile') === 'true';

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
  krakenModalOpen: boolean = false;
  paypalModalOpen: boolean = false;
  deleteAccountStep: 'closed' | 'confirm' | 'type' = 'closed';

  savingFinancial: boolean = false;
  savingName: boolean = false;
  savingApis: boolean = false;
  deletingAccount: boolean = false;

  newDisplayName: string = '';
  t212ApiKey: string = '';
  binanceKey: string = '';
  binanceSecret: string = '';
  krakenKey: string = '';
  krakenSecret: string = '';
  paypalClientId: string = '';
  paypalClientSecret: string = '';
  deleteAccountInput: string = '';
  deleteAccountError: string = '';

  userT212Linked: boolean = false;
  userBinanceLinked: boolean = false;
  userKrakenLinked: boolean = false;
  userPaypalLinked: boolean = false;

  // ── Financial Goals ───────────────────────────────────────────────────
  goals: { id: number; label: string; target: number; current: number; deadline?: string; color: string; notified?: boolean }[] = [];
  goalModalOpen: boolean = false;
  goalLabel: string = '';
  goalTarget: number = 0;
  goalDeadline: string = '';
  goalEditId: number | null = null;
  readonly goalColors = ['#c97b6a','#4a9e6b','#c9a84c','#8b7cc4','#e8813a','#009cde','#7b6f5e'];

  openGoalModal(goal?: any) {
    if (goal) {
      this.goalEditId = goal.id;
      this.goalLabel = goal.label;
      this.goalTarget = goal.target;
      this.goalDeadline = goal.deadline || '';
    } else {
      this.goalEditId = null;
      this.goalLabel = '';
      this.goalTarget = 0;
      this.goalDeadline = '';
    }
    this.goalModalOpen = true;
  }
  closeGoalModal() { this.goalModalOpen = false; }
  saveGoal() {
    if (!this.goalLabel.trim() || this.goalTarget <= 0) return;
    if (this.goalEditId !== null) {
      const g = this.goals.find(x => x.id === this.goalEditId);
      if (g) { g.label = this.goalLabel; g.target = this.goalTarget; g.deadline = this.goalDeadline; g.notified = false; }
    } else {
      if (this.goals.length >= 5) return; // max 5
      const color = this.goalColors[this.goals.length % this.goalColors.length];
      this.goals.push({ id: Date.now(), label: this.goalLabel, target: this.goalTarget, current: this.calculatedNetWorth, deadline: this.goalDeadline, color, notified: false });
    }
    this.goalModalOpen = false;
    this.checkGoalNotifications();
  }
  deleteGoal(id: number) { this.goals = this.goals.filter(g => g.id !== id); }
  goalProgress(g: { target: number; current: number }): number {
    return Math.min(100, Math.round((g.current / g.target) * 100));
  }

  // ── External balances for allocation chart ────────────────────────────
  binanceBalances: any[] = [];
  krakenBalances: any[] = [];
  paypalBalances: any[] = [];
  balancesLoading: boolean = false;

  // ── Dashboard news state ──────────────────────────────────────────────
  dashNewsTopic: string = 'etf';
  dashNewsItems: any[] = [];
  dashNewsLoading: boolean = false;
  dashNewsOpenItem: any = null;
  readonly dashNewsTopics = [
    { key: 'etf',     label: 'ETF',                symbol: 'SPY',     icon: '📈' },
    { key: 'crypto',  label: 'Cripto',             symbol: 'BTC-USD', icon: '₿'  },
    { key: 'banking', label: 'Bancarias',          symbol: 'JPM',     icon: '🏦' },
    { key: 'steam',   label: 'Mercado Steam',      symbol: 'MSFT',    icon: '🎮' },
    { key: 'assets',  label: 'Assets',             symbol: 'GLD',     icon: '🏅' },
  ];

  @ViewChild('allocPieCanvas') allocPieCanvas!: ElementRef<HTMLCanvasElement>;

  get binanceTotalEur(): number {
    return this.binanceBalances.reduce((s, b) => s + (b.total || 0), 0);
  }
  get krakenTotalEur(): number {
    return this.krakenBalances.reduce((s, b) => s + (b.total || 0), 0);
  }
  get paypalTotalEur(): number {
    return this.paypalBalances.reduce((s, b) => s + (b.total || 0), 0);
  }

  get allocSlices(): { label: string; value: number; color: string; source: string }[] {
    const slices = [
      { label: 'ETF / Ações', value: this.totalETF || 0, color: '#c97b6a', source: 'Trading 212' },
      { label: 'Imóveis', value: this.financialData.realEstateValue || 0, color: '#4a9e6b', source: 'Manual' },
      { label: 'Cripto', value: this.financialData.cryptoValue || 0, color: '#c9a84c', source: 'Manual' },
      { label: 'Binance', value: this.binanceTotalEur, color: '#e8813a', source: 'Binance' },
      { label: 'Kraken', value: this.krakenTotalEur, color: '#8b7cc4', source: 'Kraken' },
      { label: 'PayPal', value: this.paypalTotalEur, color: '#009cde', source: 'PayPal' },
      { label: 'CS2 / Steam', value: this.steamInventoryTotalValue || 0, color: '#7b9e7b', source: 'Steam' },
      { label: 'Liquidez', value: this.financialData.netWorth || 0, color: '#b5967a', source: 'Manual' },
    ].filter(s => s.value > 0);
    return slices.sort((a, b) => b.value - a.value);
  }

  get allocTotal(): number {
    return this.allocSlices.reduce((s, sl) => s + sl.value, 0);
  }

  // Combined portfolio: T212 positions + crypto from exchanges
  get allPortfolioItems(): any[] {
    const items: any[] = [];
    // T212 positions
    if (this.t212Portfolio?.data?.positions) {
      for (const p of this.t212Portfolio.data.positions) {
        items.push({
          source: 'T212', sourceColor: '#4A9EFF',
          ticker: p.ticker || '',
          name: p.fullName || p.ticker || '',
          value: p.currentValue || 0,
          change: p.ppl || null,
          changePct: (p.currentValue && p.averagePrice && p.quantity)
            ? ((p.currentValue - p.averagePrice * p.quantity) / (p.averagePrice * p.quantity) * 100) : null,
          type: 'stock'
        });
      }
    }
    // Binance crypto
    for (const b of this.binanceBalances) {
      items.push({
        source: 'Binance', sourceColor: '#F3BA2F',
        ticker: b.asset, name: b.asset,
        value: b.total || 0, change: null, changePct: null, type: 'crypto'
      });
    }
    // Kraken crypto
    for (const k of this.krakenBalances) {
      items.push({
        source: 'Kraken', sourceColor: '#5741d8',
        ticker: k.asset, name: k.asset,
        value: k.total || 0, change: null, changePct: null, type: 'crypto'
      });
    }
    // PayPal
    for (const p of this.paypalBalances) {
      items.push({
        source: 'PayPal', sourceColor: '#009cde',
        ticker: p.currency, name: `PayPal ${p.currency}`,
        value: p.total || 0, change: null, changePct: null, type: 'cash'
      });
    }
    return items.sort((a, b) => b.value - a.value);
  }

  loadExternalBalances() {
    if (this.userBinanceLinked) {
      this.userService.getBinanceBalance().subscribe({
        next: (r: any) => { this.binanceBalances = r.balances || []; this.drawAllocPie(); },
        error: () => {}
      });
    }
    if (this.userKrakenLinked) {
      this.userService.getKrakenBalance().subscribe({
        next: (r: any) => { this.krakenBalances = r.balances || []; this.drawAllocPie(); },
        error: () => {}
      });
    }
    if (this.userPaypalLinked) {
      this.userService.getPaypalBalance().subscribe({
        next: (r: any) => { this.paypalBalances = r.balances || []; this.drawAllocPie(); },
        error: () => {}
      });
    }
  }

  drawAllocPie() {
    setTimeout(() => {
      const el = this.allocPieCanvas?.nativeElement;
      if (!el) return;
      const slices = this.allocSlices.filter(s => s.value > 0);
      const total = this.allocTotal;
      if (total === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const size = 160;
      el.width = size * dpr;
      el.height = size * dpr;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      const ctx = el.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const isDark = document.body.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
      const cx = size / 2, cy = size / 2;
      const r = size / 2 - 14;
      const lw = 10; // thin stroke width
      const gapAngle = slices.length > 1 ? 0.06 : 0;

      // background track
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      ctx.lineWidth = lw;
      ctx.stroke();

      // colored arcs
      ctx.lineCap = 'round';
      let angle = -Math.PI / 2;
      for (const sl of slices) {
        const sweep = Math.max((sl.value / total) * 2 * Math.PI - gapAngle, 0.01);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle + gapAngle / 2, angle + sweep + gapAngle / 2);
        ctx.strokeStyle = sl.color;
        ctx.lineWidth = lw;
        ctx.shadowColor = sl.color + '88';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
        angle += sweep + gapAngle;
      }

      // centre label: value on top, subtitle below
      const totalStr = total >= 1000 ? '€' + (total / 1000).toFixed(1) + 'k' : '€' + Math.round(total);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDark ? '#f5f0e8' : '#2a1f14';
      ctx.font = `700 ${Math.round(size * 0.115)}px Inter,system-ui,sans-serif`;
      ctx.fillText(totalStr, cx, cy - 7);
      ctx.fillStyle = isDark ? '#8a7f6e' : '#9e8e7a';
      ctx.font = `400 ${Math.round(size * 0.075)}px Inter,system-ui,sans-serif`;
      ctx.fillText('total', cx, cy + 12);
    }, 50);
  }

  // ── Investimentos page state ──────────────────────────────────────────
  invTab: 'portfolio' | 'pesquisar' | 'watchlist' = 'portfolio';
  invSearchQuery: string = '';
  invSearchResults: any[] = [];
  invSearchLoading: boolean = false;
  invSearchDone: boolean = false;
  invTrendingCat: string = 'tendencias';
  invTrendingStocks: any[] = [];
  invTrendingLoading: boolean = false;
  readonly Math = Math;
  readonly invCategories = [
    { key: 'tendencias', label: 'Tendências', icon: '🔥' },
    { key: 'bigtech', label: 'Big Tech', icon: '💻' },
    { key: 'etfs', label: 'ETFs', icon: '📈' },
    { key: 'cripto', label: 'Cripto', icon: '₿' },
    { key: 'dividendos', label: 'Dividendos', icon: '💰' },
  ];
  invSelectedStock: any = null;
  invQuoteLoading: boolean = false;
  invChartLoading: boolean = false;
  invChartData: any[] = [];
  invChartPeriod: string = '1mo';
  invChartType: 'line' | 'candle' = 'line';
  invNewsData: any[] = [];
  invNewsLoading: boolean = false;
  invAlertModalOpen: boolean = false;
  invAlertSymbol: string = '';
  invAlertEdit: any = null; // alert being edited
  invNewAlert = { targetPrice: 0, direction: 'above' as 'above' | 'below' };
  private invSearchTimeout: any = null;
  private invAutoRefreshTimer: any = null;
  @ViewChild('invChartCanvas') invChartCanvas: any;
  private invChartMouseHandler: ((e: MouseEvent) => void) | null = null;
  private invChartLeaveHandler: (() => void) | null = null;

  // Watchlist — persisted to localStorage
  invWatchlist: { symbol: string; shortName: string; exchange: string; lastPrice?: number; change?: number; changePct?: number }[] =
    JSON.parse(localStorage.getItem('ws_inv_watchlist') || '[]');

  // Alerts — max 3 per stock, persisted to localStorage
  // { id, symbol, name, targetPrice, direction:'above'|'below', triggered:bool, createdAt }
  invAlerts: any[] = JSON.parse(localStorage.getItem('ws_inv_alerts') || '[]');

  saveWatchlist() { localStorage.setItem('ws_inv_watchlist', JSON.stringify(this.invWatchlist)); }
  saveAlerts()    { localStorage.setItem('ws_inv_alerts',    JSON.stringify(this.invAlerts)); }

  isWatching(symbol: string) { return this.invWatchlist.some(w => w.symbol === symbol); }

  toggleWatch(stock?: any) {
    const src = stock || this.invSelectedStock;
    if (!src) return;
    const sym = src.symbol;
    if (this.isWatching(sym)) {
      this.invWatchlist = this.invWatchlist.filter(w => w.symbol !== sym);
    } else {
      this.invWatchlist.push({
        symbol: sym,
        shortName: src.shortName || src.shortname || sym,
        exchange: src.exchange || '',
        lastPrice: src.regularMarketPrice,
        change: src.regularMarketChange,
        changePct: src.regularMarketChangePercent
      });
    }
    this.saveWatchlist();
  }

  alertsForSymbol(symbol: string) { return this.invAlerts.filter(a => a.symbol === symbol); }

  openInvAlertModal(target: any) {
    this.invAlertSymbol = target?.symbol || '';
    this.invAlertEdit = null;
    this.invNewAlert = { targetPrice: target?.regularMarketPrice || 0, direction: 'above' };
    this.invAlertModalOpen = true;
  }

  editAlert(alert: any) {
    this.invAlertEdit = alert;
    this.invAlertSymbol = alert.symbol;
    this.invNewAlert = { targetPrice: alert.targetPrice, direction: alert.direction };
    this.invAlertModalOpen = true;
  }

  saveInvAlert() {
    if (!this.invNewAlert.targetPrice || this.invNewAlert.targetPrice <= 0) return;
    if (this.invAlertEdit) {
      this.invAlertEdit.targetPrice = this.invNewAlert.targetPrice;
      this.invAlertEdit.direction = this.invNewAlert.direction;
      this.invAlertEdit.triggered = false;
    } else {
      const existing = this.alertsForSymbol(this.invAlertSymbol);
      if (existing.length >= 3) { alert('Máximo de 3 alertas por ação.'); return; }
      this.invAlerts.push({
        id: Date.now(),
        symbol: this.invAlertSymbol,
        name: this.invSelectedStock?.shortName || this.invAlertSymbol,
        currency: this.invSelectedStock?.currency || '€',
        targetPrice: this.invNewAlert.targetPrice,
        direction: this.invNewAlert.direction,
        triggered: false,
        createdAt: new Date().toISOString()
      });
    }
    this.saveAlerts();
    this.invAlertModalOpen = false;
    this.invAlertEdit = null;
  }

  deleteAlert(id: number) {
    this.invAlerts = this.invAlerts.filter(a => a.id !== id);
    this.saveAlerts();
  }

  checkAlerts(symbol: string, price: number) {
    let changed = false;
    this.invAlerts.forEach(a => {
      if (a.symbol !== symbol || a.triggered) return;
      const hit = a.direction === 'above' ? price >= a.targetPrice : price <= a.targetPrice;
      if (hit) {
        a.triggered = true;
        changed = true;
        this.notifications.unshift({
          id: Date.now(),
          type: 'price',
          icon: '📈',
          title: `Alerta: ${a.symbol}`,
          message: `${a.symbol} ${a.direction === 'above' ? '≥' : '≤'} ${a.currency} ${a.targetPrice.toFixed(2)} — atual: ${a.currency} ${price.toFixed(2)}`,
          time: new Date(),
          read: false
        });
        this.unreadNotifs++;
      }
    });
    if (changed) this.saveAlerts();
  }

  refreshWatchlistPrices() {
    this.invWatchlist.forEach(w => {
      this.userService.getStockQuote(w.symbol).subscribe({
        next: (q: any) => {
          w.lastPrice = q.regularMarketPrice;
          w.change = q.regularMarketChange;
          w.changePct = q.regularMarketChangePercent;
          this.checkAlerts(w.symbol, q.regularMarketPrice);
        }
      });
    });
  }

  startInvAutoRefresh() {
    this.stopInvAutoRefresh();
    this.invAutoRefreshTimer = setInterval(() => {
      if (this.invSelectedStock) {
        this.userService.getStockQuote(this.invSelectedStock.symbol).subscribe({
          next: (q: any) => {
            const prev = this.invSelectedStock;
            this.invSelectedStock = { ...prev, ...q };
            this.checkAlerts(q.symbol, q.regularMarketPrice);
          }
        });
      }
      if (this.invTab === 'watchlist') this.refreshWatchlistPrices();
    }, 30000);
  }

  stopInvAutoRefresh() {
    if (this.invAutoRefreshTimer) { clearInterval(this.invAutoRefreshTimer); this.invAutoRefreshTimer = null; }
  }

  loadInvNews(symbol: string) {
    this.invNewsLoading = true;
    this.invNewsData = [];
    this.userService.getStockNews(symbol).subscribe({
      next: (news: any[]) => { this.invNewsData = news; this.invNewsLoading = false; },
      error: () => { this.invNewsLoading = false; }
    });
  }

  openUrl(url: string) { window.open(url, '_blank', 'noopener'); }

  newsTimeAgo(ts: number): string {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts * 1000) / 60000);
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  }

  readonly INV_PERIODS = ['1d','5d','1mo','3mo','6mo','1y'];

  get invTrendingLabel(): string {
    return this.invCategories.find(c => c.key === this.invTrendingCat)?.label || this.invTrendingCat;
  }

  loadTrending(cat?: string) {
    if (cat) this.invTrendingCat = cat;
    this.invTrendingLoading = true;
    this.invTrendingStocks = [];
    this.userService.getTrendingStocks(this.invTrendingCat).subscribe({
      next: (res: any[]) => { this.invTrendingStocks = res; this.invTrendingLoading = false; },
      error: () => { this.invTrendingLoading = false; }
    });
  }

  searchStocks() {
    const q = this.invSearchQuery.trim();
    if (!q) { this.invSearchResults = []; this.invSearchDone = false; return; }
    this.invSearchLoading = true;
    this.invSearchDone = false;
    clearTimeout(this.invSearchTimeout);
    this.invSearchTimeout = setTimeout(() => {
      this.userService.searchStocks(q).subscribe({
        next: (res: any[]) => {
          this.invSearchResults = res;
          this.invSearchLoading = false;
          this.invSearchDone = true;
        },
        error: () => { this.invSearchLoading = false; this.invSearchDone = true; }
      });
    }, 400);
  }

  selectStock(item: any) {
    this.invSelectedStock = { symbol: item.symbol, shortName: item.shortname || item.shortName, longName: item.longname || item.longName, quoteType: item.typeDisp || item.quoteType };
    this.invQuoteLoading = true;
    this.invChartData = [];
    this.invNewsData = [];
    this.invChartType = 'line';
    this.userService.getStockQuote(item.symbol).subscribe({
      next: (q: any) => {
        this.invSelectedStock = { ...this.invSelectedStock, ...q };
        this.invQuoteLoading = false;
        this.loadInvChart();
        this.loadInvNews(item.symbol);
        this.startInvAutoRefresh();
        this.checkAlerts(item.symbol, q.regularMarketPrice);
      },
      error: () => { this.invQuoteLoading = false; }
    });
  }

  loadInvChart() {
    if (!this.invSelectedStock?.symbol) return;
    this.invChartLoading = true;
    this.userService.getStockChart(this.invSelectedStock.symbol, this.invChartPeriod).subscribe({
      next: (res: any) => {
        this.invChartData = res.quotes || [];
        this.invChartLoading = false;
        const tryDraw = (attempts = 0) => {
          if (this.invChartCanvas) { this.drawInvChart(); }
          else if (attempts < 15) { requestAnimationFrame(() => tryDraw(attempts + 1)); }
        };
        requestAnimationFrame(() => tryDraw());
      },
      error: () => { this.invChartLoading = false; }
    });
  }

  drawInvChart() {
    if (!this.invChartCanvas || !this.invChartData.length) return;
    const canvas = this.invChartCanvas.nativeElement as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const data = this.invChartData;
    const isIntraday = this.invChartPeriod === '1d' || this.invChartPeriod === '5d';
    const pad = { top: 18, right: 12, bottom: 24, left: 52 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    const allValues = data.flatMap((d: any) => [d.high ?? d.close, d.low ?? d.close, d.close].filter((v: any) => v != null));
    const minP = Math.min(...allValues);
    const maxP = Math.max(...allValues);
    const range = maxP - minP || 1;
    const prices = data.map((d: any) => d.close).filter((v: any) => v != null);
    if (prices.length < 2) return;

    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? '#4a9e6b' : '#c97b6a';
    const fillColor = isUp ? 'rgba(74,158,107,0.12)' : 'rgba(201,123,106,0.12)';

    const xOf = (i: number) => pad.left + (i / (data.length - 1)) * cW;
    const yOf = (v: number) => pad.top + (1 - (v - minP) / range) * cH;

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * cH;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        const val = maxP - (i / 4) * range;
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(2), pad.left - 4, y + 3);
      }
    };

    const drawXLabels = () => {
      const nLabels = Math.min(6, data.length);
      const step = Math.floor(data.length / (nLabels - 1)) || 1;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px DM Mono, monospace'; ctx.textAlign = 'center';
      for (let i = 0; i < data.length; i += step) {
        const d = new Date(data[i].date);
        const label = isIntraday ? d.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString('pt', { day: '2-digit', month: 'short' });
        ctx.fillText(label, xOf(i), H - 6);
      }
    };

    const smoothPath = (pts: [number,number][]) => {
      if (pts.length < 2) return;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = i > 0 ? pts[i - 1] : pts[i];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const [x3, y3] = i < pts.length - 2 ? pts[i + 2] : pts[i + 1];
        const t = 0.18;
        ctx.bezierCurveTo(x1 + (x2 - x0) * t, y1 + (y2 - y0) * t, x2 - (x3 - x1) * t, y2 - (y3 - y1) * t, x2, y2);
      }
    };

    const drawCandles = (hoverIdx: number | null) => {
      const barW = Math.max(2, Math.min(12, cW / data.length - 2));
      data.forEach((d: any, i: number) => {
        if (d.close == null) return;
        const o = d.open ?? d.close;
        const h = d.high ?? d.close;
        const l = d.low ?? d.close;
        const c = d.close;
        const cx = xOf(i);
        const isGreen = c >= o;
        const col = isGreen ? '#4a9e6b' : '#c97b6a';
        const alpha = (hoverIdx !== null && hoverIdx !== i) ? 0.4 : 1;
        ctx.globalAlpha = alpha;
        // wick
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, yOf(h)); ctx.lineTo(cx, yOf(l)); ctx.stroke();
        // body
        const yTop = yOf(Math.max(o, c));
        const bodyH = Math.max(1, Math.abs(yOf(o) - yOf(c)));
        ctx.fillStyle = col;
        ctx.fillRect(cx - barW / 2, yTop, barW, bodyH);
        ctx.globalAlpha = 1;
      });
    };

    const pts: [number,number][] = prices.map((v: number, i: number) => [xOf(i), yOf(v)]);

    const drawLine = (hoverIdx: number | null) => {
      ctx.beginPath(); smoothPath(pts);
      ctx.lineTo(xOf(prices.length - 1), H - pad.bottom); ctx.lineTo(xOf(0), H - pad.bottom); ctx.closePath();
      ctx.fillStyle = fillColor; ctx.fill();
      ctx.beginPath(); smoothPath(pts); ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      if (hoverIdx !== null) {
        const hx = xOf(hoverIdx); const hy = yOf(prices[hoverIdx]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, pad.top); ctx.lineTo(hx, H - pad.bottom); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fillStyle = lineColor; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    };

    const redraw = (hoverIdx: number | null) => {
      ctx.clearRect(0, 0, W, H);
      drawGrid();
      if (this.invChartType === 'candle') drawCandles(hoverIdx);
      else drawLine(hoverIdx);
      drawXLabels();
    };

    redraw(null);

    if (this.invChartMouseHandler) canvas.removeEventListener('mousemove', this.invChartMouseHandler);
    if (this.invChartLeaveHandler) canvas.removeEventListener('mouseleave', this.invChartLeaveHandler);

    this.invChartMouseHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const rawIdx = Math.round(((mx - pad.left) / cW) * (data.length - 1));
      const idx = Math.max(0, Math.min(data.length - 1, rawIdx));
      redraw(idx);
      const tooltip = document.getElementById('invChartTooltip');
      if (!tooltip) return;
      const d2 = new Date(data[idx].date);
      const dateStr = isIntraday ? d2.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' })
        : d2.toLocaleDateString('pt', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
      const cur = this.invSelectedStock?.currency || '€';
      const item = data[idx];
      const isCandle = this.invChartType === 'candle';
      const col = (item.close >= (item.open ?? item.close)) ? '#4a9e6b' : '#c97b6a';
      tooltip.innerHTML = isCandle
        ? `<div style="margin-bottom:4px;color:rgba(255,255,255,0.5)">${dateStr}</div>
           <div style="font-size:11px;color:${col}">O: ${cur} ${(item.open??item.close).toFixed(2)} &nbsp; H: ${(item.high??item.close).toFixed(2)} &nbsp; L: ${(item.low??item.close).toFixed(2)} &nbsp; C: ${item.close.toFixed(2)}</div>`
        : `<div style="margin-bottom:4px;color:rgba(255,255,255,0.5)">${dateStr}</div><div style="font-size:13px;font-weight:600;color:${lineColor}">${cur} ${item.close.toFixed(2)}</div>`;
      const containerRect = canvas.parentElement!.getBoundingClientRect();
      let left = e.clientX - containerRect.left + 12;
      if (left + 160 > containerRect.width) left -= 180;
      tooltip.style.left = left + 'px';
      tooltip.style.top = (e.clientY - containerRect.top - 20) + 'px';
      tooltip.style.display = 'block';
    };
    this.invChartLeaveHandler = () => {
      redraw(null);
      const tooltip = document.getElementById('invChartTooltip');
      if (tooltip) tooltip.style.display = 'none';
    };
    canvas.addEventListener('mousemove', this.invChartMouseHandler);
    canvas.addEventListener('mouseleave', this.invChartLeaveHandler);
  }

  clearInvSelected() {
    this.stopInvAutoRefresh();
    this.invSelectedStock = null;
    this.invChartData = [];
    this.invNewsData = [];
    this.invSearchResults = [];
    this.invSearchQuery = '';
  }

  // Market Data State
  marketData: any = {};
  marketDataLoading: boolean = false;
  marketDataUpdatedAt: Date | null = null;

  // Watchlist & Market State
  wlChartModalOpen: boolean = false;
  selectedWlItem: any = null;
  selectedWlTimeframe: string = '1m';
  wlSearchQuery: string = '';
  selectedMarketGameName: string = 'Counter-Strike 2';
  selectedMarketGameId: string = 'cs2';

  selectMarketGame(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedMarketGameId = val;
    const names: Record<string, string> = {
      cs2: 'Counter-Strike 2', rust: 'Rust', tf2: 'Team Fortress 2',
      kf2: 'Killing Floor 2', warframe: 'Warframe', h1z1: 'Z1 Battle Royale'
    };
    this.selectedMarketGameName = names[val] || val;
  }
  
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
  steamInventories: { [game: string]: any } = {};
  steamLoading: boolean = false;
  steamError: string = '';

  // Loading messages
  private readonly syncMessages = [
    '🔄 A sincronizar inventário...',
    '📦 A carregar os teus itens...',
    '💰 A medir preços no Steam Market...',
    '🔍 A calcular floats das skins...',
    '✨ Quase pronto...'
  ];
  syncMessageIndex: number = 0;
  private syncMessageInterval: any = null;

  private startSyncMessages() {
    this.syncMessageIndex = 0;
    clearInterval(this.syncMessageInterval);
    this.syncMessageInterval = setInterval(() => {
      this.syncMessageIndex = (this.syncMessageIndex + 1) % this.syncMessages.length;
    }, 1800);
  }

  private stopSyncMessages() {
    clearInterval(this.syncMessageInterval);
    this.syncMessageInterval = null;
  }

  get currentSyncMessage(): string {
    return this.syncMessages[this.syncMessageIndex];
  }
  currentSteamTab: string = 'inventario';
  steamSortOption: string = 'value_desc';
  steamInventorySearch: string = '';
  steamInventoryGameFilter: string = 'cs2';
  steamInventoryGames = [
    { id: 'cs2',      name: 'Counter-Strike 2' },
    { id: 'rust',     name: 'Rust' },
    { id: 'tf2',      name: 'Team Fortress 2' },
    { id: 'unturned', name: 'Unturned' },
    { id: 'payday2',  name: 'PAYDAY 2' },
    { id: 'kf2',      name: 'Killing Floor 2' },
    { id: 'warframe', name: 'Warframe' },
    { id: 'h1z1',     name: 'Z1 Battle Royale' },
    { id: 'banana',   name: 'Banana' }
  ];
  
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

  // Case data: casePrice = Steam market price, keyPrice = key cost (0 for capsules)
  // ev = estimated average return based on community drop data
  CS2_CASES: any[] = [
    { name: 'Kilowatt Case',        icon: '⚡', casePrice: 1.20, keyPrice: 2.19, ev: 1.82, tag: 'cases' },
    { name: 'Revolution Case',      icon: '📦', casePrice: 0.87, keyPrice: 2.19, ev: 1.42, tag: 'cases' },
    { name: 'Gallery Case',         icon: '🖼️', casePrice: 2.50, keyPrice: 2.19, ev: 2.15, tag: 'cases' },
    { name: 'Recoil Case',          icon: '🎯', casePrice: 0.45, keyPrice: 2.19, ev: 1.18, tag: 'cases' },
    { name: 'Dreams & Nightmares',  icon: '🌙', casePrice: 0.38, keyPrice: 2.19, ev: 1.10, tag: 'cases' },
    { name: 'Fracture Case',        icon: '💥', casePrice: 0.42, keyPrice: 2.19, ev: 1.22, tag: 'cases' },
    { name: 'CS20 Case',            icon: '🏆', casePrice: 0.55, keyPrice: 2.19, ev: 1.35, tag: 'cases' },
    { name: 'Prisma 2 Case',        icon: '🌈', casePrice: 0.49, keyPrice: 2.19, ev: 1.28, tag: 'cases' },
    // Capsules (no key needed)
    { name: 'Paris 2023 Legends',       icon: '🏅', casePrice: 0.24, keyPrice: 0, ev: 0.12, tag: 'capsules' },
    { name: 'Paris 2023 Challengers',   icon: '🎖️', casePrice: 0.18, keyPrice: 0, ev: 0.09, tag: 'capsules' },
    { name: 'Stockholm 2021 Challengers', icon: '💎', casePrice: 4.20, keyPrice: 0, ev: 2.80, tag: 'capsules' },
    { name: 'Antwerp 2022 Legends',     icon: '⭐', casePrice: 0.55, keyPrice: 0, ev: 0.30, tag: 'capsules' },
    { name: 'Rio 2022 Legends',         icon: '🌴', casePrice: 0.32, keyPrice: 0, ev: 0.18, tag: 'capsules' },
    // Terminals / Armory
    { name: 'Gallery Case Terminal',   icon: '🖼️', casePrice: 3.00, keyPrice: 0, ev: 1.80, tag: 'terminals' },
    { name: 'Armory Pass (1 Crédito)', icon: '🔑', casePrice: 1.50, keyPrice: 0, ev: 0.90, tag: 'terminals' },
  ];

  caseSim: any = {
    selected: null as any,
    numSim: 50,
    simResult: null as any,
    simLoading: false
  };

  get filteredCases(): any[] {
    return this.CS2_CASES.filter(c => c.tag === this.caseCategory);
  }

  getCaseQty(caseName: string): number {
    if (!this.steamInventory?.items) return 0;
    const item = this.steamInventory.items.find((i: any) =>
      i.name?.toLowerCase().includes(caseName.toLowerCase().replace(' case','').replace(' capsule','').trim())
    );
    return item?.quantity || 0;
  }

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

  simRendas = {
    valorImovel: 150000,
    renda: 700,
    prestacao: 485,
    despesas: 80,
    results: {
      yieldBruto: 0,
      yieldLiquido: 0,
      cashflow: 0,
      payback: 0
    }
  };

  simInflacao = {
    valor: 10000,
    taxa: 2.5,
    anos: 20,
    retorno: 7,
    results: {
      valorFuturoInflacao: 0,
      perdaPoderCompra: 0,
      ganhoInvestimento: 0,
      retornoReal: 0
    }
  };

  // PT bank spreads (Jun 2026 — update manually as needed)
  bankSpreads = [
    { bank: 'Caixa Geral de Depósitos', spread: 0.80, taeg: 4.25, flag: '🟢', note: 'Habitação própria permanente' },
    { bank: 'Millennium BCP',           spread: 0.85, taeg: 4.30, flag: '🟢', note: 'Spread fixo nos 2 primeiros anos' },
    { bank: 'Santander Portugal',       spread: 0.85, taeg: 4.32, flag: '🟢', note: 'Inclui domiciliação de ordenado' },
    { bank: 'Novo Banco',               spread: 0.95, taeg: 4.40, flag: '🟡', note: 'Sem exigência de domiciliação' },
    { bank: 'BPI',                      spread: 0.90, taeg: 4.35, flag: '🟢', note: 'Spread misto (taxa variável)' },
    { bank: 'Banco CTT',                spread: 1.00, taeg: 4.50, flag: '🟡', note: 'Processo 100% digital' },
    { bank: 'Crédito Agrícola',         spread: 0.90, taeg: 4.38, flag: '🟢', note: 'Sócios CA têm spread reduzido' },
    { bank: 'UCI (Unicre)',             spread: 0.75, taeg: 4.20, flag: '🟢', note: 'Melhor spread disponível no mercado' },
  ];

  applyBankSpread(spread: number) {
    this.simCH.spread = spread;
    this.calcCH();
  }

  marketRates = [
    { bank: 'BCE (Europa)', rate: '4.50%', trend: 'estável', asset: 'Euribor 6M: Live' },
    { bank: 'FED (EUA)', rate: '4.25%', trend: 'dn', asset: 'Treasury 10Y: 4.3%' },
    { bank: 'Caixa Geral', rate: '4.25%', trend: 'promo', asset: 'Spread: 0.80%' },
    { bank: 'Santander PT', rate: '4.32%', trend: 'promo', asset: 'Spread: 0.85%' },
    { bank: 'Novo Banco', rate: '4.40%', trend: 'alta', asset: 'Spread: 0.95%' }
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
    this.appTheme = this.isDark ? 'dark' : 'light';
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
    // Close notification dropdown on outside click
    document.addEventListener('click', () => { this.notifOpen = false; });
    // Initialize case simulator with first case
    this.caseSim.selected = this.CS2_CASES[0];
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
    this.calcSimAll();
    this.loadDashNews();
    this.loadForumPosts(); // populate dashTrendingPosts on dashboard
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
        this.binanceSecret = '';
        this.krakenKey = '';
        this.krakenSecret = '';
        this.userT212Linked = !!user.hasTrading212ApiKey;
        this.userBinanceLinked = !!user.hasBinanceApiKey;
        this.userKrakenLinked = !!user.hasKrakenApiKey;
        this.userPaypalLinked = !!user.hasPaypalClientId;

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
        this.loadExternalBalances();
        setTimeout(() => { this.drawAllocPie(); this.checkGoalNotifications(); }, 300);
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

  setTheme(theme: string) {
    this.appTheme = theme;
    this.isDark = theme === 'dark';
    localStorage.setItem('ws-theme', theme);
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  exportData() {
    const now = new Date();
    const data = {
      "📋 Exportação WealthSphere": {
        "Data de exportação": now.toLocaleDateString('pt-PT', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
        "Hora": now.toLocaleTimeString('pt-PT'),
        "Utilizador": this.userName,
        "Email": this.userEmail
      },
      "💰 Perfil Financeiro": {
        "Património líquido (€)": this.financialData?.netWorth ?? 0,
        "Rendimento mensal líquido (€)": this.financialData?.monthlyIncome ?? 0,
        "Despesas mensais (€)": this.financialData?.monthlyExpenses ?? 0,
        "Portfólio ETF (€)": this.financialData?.etfPortfolio ?? 0,
        "Valor imóveis (€)": this.financialData?.realEstateValue ?? 0,
        "Cripto & outros (€)": this.financialData?.cryptoValue ?? 0
      },
      "⚙️ Configurações": {
        "Salário mensal (€)": this.customSettings?.salary ?? 0,
        "Freelance (€)": this.customSettings?.freelance ?? 0,
        "Supermercado/mês (€)": this.customSettings?.supermarket ?? 0,
        "Eletricidade/mês (€)": this.customSettings?.electricity ?? 0,
        "Ganhos Steam (€)": this.customSettings?.steamEarnings ?? 0,
        "Tema": this.appTheme,
        "Língua": this.appLanguage
      },
      "🏠 Imóveis": this.realEstate.map((p: any) => ({
        "Nome": p.name,
        "Tipologia": p.typology,
        "Localização": p.location,
        "Renda mensal (€)": p.rentAmount,
        "Valor atual (€)": p.currentValue,
        "Estado": p.status,
        "Banco crédito": p.creditBank || "—",
        "Dívida crédito (€)": p.creditDebt || 0
      })),
      "📊 Transações Income Tracker": this.txEntries.map((t: any) => ({
        "Data": t.date,
        "Tipo": t.type === 'receita' ? 'Receita' : 'Despesa',
        "Categoria": t.category,
        "Descrição": t.description,
        "Valor (€)": t.amount
      })).sort((a: any, b: any) => b["Data"].localeCompare(a["Data"])),
      "🔔 Alertas de Preço Steam": this.priceAlerts.map((a: any) => ({
        "Item": a.itemName,
        "Preço alvo (€)": a.targetPrice,
        "Preço atual (€)": a.currentPrice ?? "—",
        "Disparado": a.triggered ? "Sim" : "Não"
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wealthsphere_${now.toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          this.drawAllocPie();
          // Load portfolio evolution history after getting fresh data
          this.loadT212History();
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

  openBinanceModal() { this.binanceKey = ''; this.binanceSecret = ''; this.binanceModalOpen = true; }
  closeBinanceModal() { this.binanceModalOpen = false; }
  saveBinance() {
    if (!this.binanceKey.trim() || !this.binanceSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ binanceApiKey: this.binanceKey, binanceApiSecret: this.binanceSecret }).subscribe({
      next: () => { this.savingApis = false; this.closeBinanceModal(); this.loadProfile(); alert('Binance ligada com sucesso!'); },
      error: (err: any) => { this.savingApis = false; alert('Erro: ' + (err.error?.message || err.message)); }
    });
  }

  openKrakenModal() { this.krakenKey = ''; this.krakenSecret = ''; this.krakenModalOpen = true; }
  closeKrakenModal() { this.krakenModalOpen = false; }
  saveKraken() {
    if (!this.krakenKey.trim() || !this.krakenSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ krakenApiKey: this.krakenKey, krakenApiSecret: this.krakenSecret }).subscribe({
      next: () => { this.savingApis = false; this.closeKrakenModal(); this.loadProfile(); alert('Kraken ligado com sucesso!'); },
      error: (err: any) => { this.savingApis = false; alert('Erro: ' + (err.error?.message || err.message)); }
    });
  }

  openPaypalModal() { this.paypalClientId = ''; this.paypalClientSecret = ''; this.paypalModalOpen = true; }
  closePaypalModal() { this.paypalModalOpen = false; }
  savePaypal() {
    if (!this.paypalClientId.trim() || !this.paypalClientSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ paypalClientId: this.paypalClientId, paypalClientSecret: this.paypalClientSecret }).subscribe({
      next: () => { this.savingApis = false; this.closePaypalModal(); this.loadProfile(); alert('PayPal ligado com sucesso!'); },
      error: (err: any) => { this.savingApis = false; alert('Erro: ' + (err.error?.message || err.message)); }
    });
  }

  // ── Income Tracker ──
  txModalOpen: boolean = false;
  incomeTxFilter: string = 'todos';
  incomeFilterMonth: string = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  txEntries: any[] = JSON.parse(localStorage.getItem('ws_tx_entries') || '[]');
  newTx: any = { type: 'receita', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), category: 'Salário' };

  get incomeMonths(): { value: string; label: string }[] {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }) });
    }
    return months;
  }

  get incomeMonthLabel(): string {
    const m = this.incomeMonths.find(m => m.value === this.incomeFilterMonth);
    return m ? m.label : this.incomeFilterMonth;
  }

  filterIncomeByMonth() { /* triggers getter re-evaluation */ }

  get incomeEntries(): any[] {
    return this.txEntries.filter(t => t.type === 'receita' && t.date?.startsWith(this.incomeFilterMonth));
  }

  get expenseEntries(): any[] {
    return this.txEntries.filter(t => t.type === 'despesa' && t.date?.startsWith(this.incomeFilterMonth));
  }

  get incomeThisMonth(): number {
    return this.incomeEntries.reduce((s, t) => s + (+t.amount || 0), 0);
  }

  get expenseThisMonth(): number {
    return this.expenseEntries.reduce((s, t) => s + (+t.amount || 0), 0);
  }

  get filteredTxEntries(): any[] {
    return this.txEntries.filter(t => {
      const inMonth = t.date?.startsWith(this.incomeFilterMonth);
      const typeMatch = this.incomeTxFilter === 'todos' || t.type === this.incomeTxFilter;
      return inMonth && typeMatch;
    }).sort((a, b) => b.date?.localeCompare(a.date || '') || 0);
  }

  get categoryTotals(): any[] {
    const catMap: { [k: string]: { name: string; icon: string; total: number; type: string } } = {};
    const catIcons: { [k: string]: string } = {
      'Salário':'💼','Freelance':'💻','Rendas':'🏠','Investimentos':'📈','Outros (Receita)':'💰',
      'Habitação':'🏡','Alimentação':'🛒','Transporte':'🚗','Serviços':'⚡','Saúde':'🏥',
      'Lazer':'🎮','Educação':'📚','Outros (Despesa)':'💸'
    };
    this.filteredTxEntries.forEach(t => {
      if (!catMap[t.category]) catMap[t.category] = { name: t.category, icon: catIcons[t.category] || '📂', total: 0, type: t.type };
      catMap[t.category].total += +t.amount || 0;
    });
    const cats = Object.values(catMap);
    const maxTotal = Math.max(...cats.map(c => c.total), 1);
    return cats.map(c => ({ ...c, pct: Math.round((c.total / maxTotal) * 100) }))
               .sort((a, b) => b.total - a.total);
  }

  openTxModal() {
    this.newTx = { type: 'receita', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), category: 'Salário' };
    this.txModalOpen = true;
  }

  saveTxEntry() {
    if (!this.newTx.description.trim() || !this.newTx.amount || this.newTx.amount <= 0) return;
    const entry = { ...this.newTx, id: Date.now(), amount: +this.newTx.amount };
    this.txEntries.push(entry);
    localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
    this.txModalOpen = false;
  }

  deleteTxEntry(tx: any) {
    this.txEntries = this.txEntries.filter(t => t.id !== tx.id);
    localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
  }

  exportIncomeCSV() {
    const rows = [['Data','Tipo','Categoria','Descrição','Valor (€)']];
    this.txEntries
      .filter(t => t.date?.startsWith(this.incomeFilterMonth))
      .sort((a, b) => a.date?.localeCompare(b.date || '') || 0)
      .forEach(t => rows.push([t.date, t.type, t.category, t.description, t.amount.toFixed(2)]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transacoes_${this.incomeFilterMonth}.csv`;
    a.click();
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
    const cash = this.financialData.netWorth || 0;
    const etf = this.totalETF || 0;
    const crypto = this.financialData.cryptoValue || 0;
    const realEstate = this.financialData.realEstateValue || 0;
    const cs2 = this.steamInventoryTotalValue || 0;
    const binance = this.binanceTotalEur;
    const kraken = this.krakenTotalEur;
    const paypal = this.paypalTotalEur;
    return cash + etf + crypto + realEstate + cs2 + binance + kraken + paypal;
  }

  generateChartData() {
    const networthVal = this.calculatedNetWorth;
    const etfVal = this.totalETF;
    const rendasVal = this.financialData.realEstateValue || 0;
    const steamVal = this.steamInventoryTotalValue || 0;
    const savingsVal = this.totalSavings || 0;

    // Seeded pseudo-random using a simple LCG so chart is stable across renders
    const seed = (networthVal * 13 + 7) | 0;
    const lcg = (s: number) => { let v = s; return () => { v = (v * 1664525 + 1013904223) & 0xffffffff; return (v >>> 0) / 0xffffffff; }; };
    const rand = lcg(seed);

    const makeCurve = (len: number, finalVal: number, baselinePercent: number = 0.85) => {
      if (finalVal <= 0) return Array(len).fill(0);
      // Build a random walk starting from baselinePercent*finalVal ending at finalVal
      const start = finalVal * baselinePercent;
      const rawWalk: number[] = [];
      let v = start;
      for (let i = 0; i < len; i++) {
        rawWalk.push(v);
        // Each step: drift toward end + random noise ±3-5% of finalVal
        const progress = i / (len - 1);
        const drift = (finalVal - v) * (0.3 + progress * 0.4);
        const volatility = finalVal * (0.025 + (1 - progress) * 0.03);
        v += drift + (rand() - 0.5) * 2 * volatility;
        if (v < 0) v = 0;
      }
      // Force last point to be exactly finalVal
      rawWalk[len - 1] = finalVal;
      return rawWalk.map(p => Number(p.toFixed(2)));
    };

    // 1D (Hoje) - 8 points (hourly)
    this.data['1d'] = {
      networth: makeCurve(8, networthVal, 0.99),
      etf: makeCurve(8, etfVal, 0.99),
      rendas: Array(8).fill(rendasVal),
      steam: makeCurve(8, steamVal, 0.99),
      savings: makeCurve(8, savingsVal, 0.99),
      labels: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00']
    };

    // 1W (1 Semana) - 7 days
    this.data['1w'] = {
      networth: makeCurve(7, networthVal, 0.98),
      etf: makeCurve(7, etfVal, 0.97),
      rendas: makeCurve(7, rendasVal, 1.0),
      steam: makeCurve(7, steamVal, 0.98),
      savings: makeCurve(7, savingsVal, 0.98),
      labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    };

    // 6M (6 Meses) - 7 months
    this.data['6m'] = {
      networth: makeCurve(7, networthVal, 0.88),
      etf: makeCurve(7, etfVal, 0.82),
      rendas: makeCurve(7, rendasVal, 0.95),
      steam: makeCurve(7, steamVal, 0.85),
      savings: makeCurve(7, savingsVal, 0.80),
      labels: ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
    };

    // 1A (1 Ano) - 12 months
    this.data['1a'] = {
      networth: makeCurve(12, networthVal, 0.78),
      etf: makeCurve(12, etfVal, 0.68),
      rendas: makeCurve(12, rendasVal, 0.90),
      steam: makeCurve(12, steamVal, 0.75),
      savings: makeCurve(12, savingsVal, 0.70),
      labels: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai']
    };

    // 3A (3 Anos) - 24 points (bi-monthly approx)
    this.data['3a'] = {
      networth: makeCurve(24, networthVal, 0.55),
      etf: makeCurve(24, etfVal, 0.40),
      rendas: makeCurve(24, rendasVal, 0.75),
      steam: makeCurve(24, steamVal, 0.50),
      savings: makeCurve(24, savingsVal, 0.45),
      labels: ['2024 Q1', 'Q2', 'Q3', 'Q4', '2025 Q1', 'Q2', 'Q3', 'Q4', '2026 Q1', 'Q2']
    };

    // MAX (Máximo) - 36 points
    this.data['max'] = {
      networth: makeCurve(36, networthVal, 0.35),
      etf: makeCurve(36, etfVal, 0.20),
      rendas: makeCurve(36, rendasVal, 0.60),
      steam: makeCurve(36, steamVal, 0.30),
      savings: makeCurve(36, savingsVal, 0.25),
      labels: ['2023', '2024', '2025', '2026']
    };
  }

  get totalExpenses() {
    let propExpTotal = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    this.realEstate.forEach(r => {
      if (r.expenses) {
        r.expenses.forEach((e: any) => {
          const expDate = new Date(e.date || Date.now());
          if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
            propExpTotal += (e.amount || 0);
          }
        });
      }
    });
    return (this.customSettings.supermarket || 0) + 
           (this.customSettings.electricity || 0) + 
           propExpTotal;
  }

  get totalSavings() {
    return this.totalIncome - this.totalExpenses;
  }

  get currentMonthDaysInfo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // 28, 29, 30, or 31 days
    const currentDay = now.getDate();
    const daysLeft = daysInMonth - currentDay;
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = monthNames[month];
    
    return `${monthName} (${daysInMonth} dias · ${currentDay} decorridos · ${daysLeft} restantes)`;
  }

  getCurrentMonthExpenses(prop: any): any[] {
    if (!prop || !prop.expenses) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return prop.expenses.filter((e: any) => {
      const expDate = new Date(e.date || Date.now());
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });
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

  loadSteamInventory(force: boolean = false) {
    const game = this.steamInventoryGameFilter || 'cs2';
    this.steamLoading = true;
    this.steamError = '';
    this.steamInventory = null;
    this.startSyncMessages();
    this.userService.getSteamInventory(game, force).subscribe({
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
        this.steamInventories[game] = res;
        this.steamInventory = res;
        this.steamError = '';
        this.steamLoading = false;
        console.log('Steam inventory set:', this.steamInventory);
        this.stopSyncMessages();
        // Backend já retorna preços automaticamente, não precisa buscar no frontend
        this.generateChartData();
        if (this.currentPage === 'dashboard') {
          this.drawPatrimonioChart(this.data[this.currentChartPeriod]);
        }
      },
      error: (err) => {
        console.error('Steam inventory error:', err);
        this.stopSyncMessages();
        this.steamError = err.error?.message || 'Erro ao ligar à Steam';
        this.steamLoading = false;
      }
    });
  }

  onSteamGameChange(game: string) {
    this.steamInventoryGameFilter = game;
    this.steamInventorySearch = '';
    this.loadSteamInventory();
  }

  get selectedSteamGameName(): string {
    return this.steamInventoryGames.find(game => game.id === this.steamInventoryGameFilter)?.name || 'Steam';
  }

  get sortedSteamInventory() {
    if (!this.steamInventory || !this.steamInventory.items) return [];
    const query = this.steamInventorySearch.trim().toLowerCase();
    const filtered: any[] = this.steamInventory.items.filter((item: any) => {
      const searchable = `${item.name || ''} ${item.baseName || ''} ${item.type || ''} ${item.rarity || ''}`.toLowerCase();
      return !query || searchable.includes(query);
    });

    // Group items without float (cases, stickers, etc.) by name
    const grouped: any[] = [];
    const seen = new Map<string, any>();
    for (const item of filtered) {
      const hasFloat = item.float !== undefined && item.float !== null;
      if (hasFloat) {
        // Unique weapon — keep individual
        grouped.push({ ...item, groupedQty: 1 });
      } else {
        if (seen.has(item.name)) {
          const g = seen.get(item.name);
          g.groupedQty++;
          g.price = (g.unitPrice || 0) * g.groupedQty;
        } else {
          const g = { ...item, groupedQty: 1, unitPrice: item.price };
          seen.set(item.name, g);
          grouped.push(g);
        }
      }
    }

    const rarityWeight: {[key: string]: number} = {
      'eb4b4b': 5, 'd32ce6': 4, '8847ff': 3, '4b69ff': 2, '5e98d9': 1, 'b0c3d9': 0
    };

    if (this.steamSortOption === 'value_desc') {
      grouped.sort((a: any, b: any) => (b.price || 0) - (a.price || 0));
    } else if (this.steamSortOption === 'value_asc') {
      grouped.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    } else if (this.steamSortOption === 'rarity') {
      grouped.sort((a: any, b: any) => {
        const wA = rarityWeight[a.color?.toLowerCase()] || 0;
        const wB = rarityWeight[b.color?.toLowerCase()] || 0;
        return wB - wA;
      });
    }
    return grouped;
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
    const existing = this.getAlert(skin.name);
    this.skinAlertTarget = existing ? existing.targetPrice : (skin.price ? +(skin.price * 1.1).toFixed(2) : 0);
  }

  closeSkinModal() {
    this.skinModalOpen = false;
    this.selectedSkin = null;
  }

  // --- Float Helpers ---
  getFloatWear(f: number | null): string {
    if (f === null || f === undefined) return 'N/A';
    if (f < 0.07)  return 'Factory New';
    if (f < 0.15)  return 'Minimal Wear';
    if (f < 0.38)  return 'Field-Tested';
    if (f < 0.45)  return 'Well-Worn';
    return 'Battle-Scarred';
  }

  getFloatColor(f: number | null): string {
    if (f === null || f === undefined) return '#888';
    if (f < 0.07)  return '#4ade80';
    if (f < 0.15)  return '#86efac';
    if (f < 0.38)  return '#fbbf24';
    if (f < 0.45)  return '#f97316';
    return '#ef4444';
  }

  getFloatPct(f: number | null): number {
    if (f === null || f === undefined) return 0;
    return Math.min(Math.max(f * 100, 0), 100);
  }

  // --- Real Estate Methods ---
  ngAfterViewInit() {
    // Use rAF to ensure layout is complete before reading offsetWidth
    const tryDraw = (attempts = 0) => {
      if (!this.chartCanvas) return;
      const w = this.chartCanvas.nativeElement?.offsetWidth || 0;
      if (w > 0) {
        this.drawPatrimonioChart(this.data[this.currentChartPeriod]);
      } else if (attempts < 10) {
        requestAnimationFrame(() => tryDraw(attempts + 1));
      }
    };
    requestAnimationFrame(() => tryDraw());
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
    if (name === 'comunidade') {
      this.loadForumPosts();
    }
    if (name === 'taxas') {
      this.loadMarketData();
    }
    if (name === 'investimentos') {
      if (!this.t212Portfolio) this.loadT212Portfolio();
      else if (this.t212History.length >= 2) {
        setTimeout(() => this.drawT212Chart(), 100);
      }
      if (this.invSelectedStock) this.startInvAutoRefresh();
      if (this.invTrendingStocks.length === 0) this.loadTrending();
    } else {
      this.stopInvAutoRefresh();
    }
    if (name === 'simulador') {
      // Auto-fill Euribor 6M into the CH simulator from live data
      this.loadMarketData();
      setTimeout(() => {
        if (this.marketData?.euribor6m != null) {
          this.simCH.euribor = +this.marketData.euribor6m.toFixed(3);
          this.calcCH();
        }
      }, 1500);
    }
  }

  loadMarketData(force = false) {
    if (this.marketDataLoading) return;
    if (!force && this.marketDataUpdatedAt && (Date.now() - this.marketDataUpdatedAt.getTime()) < 5 * 60 * 1000) return;
    this.marketDataLoading = true;
    this.userService.getMarketData().subscribe({
      next: (data: any) => {
        this.marketData = data;
        this.marketDataUpdatedAt = new Date();
        this.marketDataLoading = false;
      },
      error: () => {
        this.marketDataLoading = false;
      }
    });
  }

  marketDataAge(): string {
    if (!this.marketDataUpdatedAt) return '';
    const diff = Math.floor((Date.now() - this.marketDataUpdatedAt.getTime()) / 1000);
    if (diff < 60) return `há ${diff}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    return `há ${Math.floor(diff / 3600)}h`;
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
  selectCase(nameOrObj: any, price?: string, ev?: number) {
    // Support both old string call and new object call
    if (typeof nameOrObj === 'object') {
      this.caseSim.selected = nameOrObj;
    } else {
      const casePrice = parseFloat((price || '0').replace('€',''));
      const found = this.CS2_CASES.find(c => c.name === nameOrObj);
      this.caseSim.selected = found || { name: nameOrObj, casePrice, keyPrice: 2.19, ev: ev || 1.0, icon: '📦', tag: 'cases' };
    }
    this.caseSim.simResult = null;
  }

  get caseUnitCost(): number {
    if (!this.caseSim.selected) return 0;
    return (this.caseSim.selected.casePrice || 0) + (this.caseSim.selected.keyPrice || 0);
  }

  get caseROI(): number {
    if (!this.caseSim.selected || !this.caseUnitCost) return 0;
    return ((this.caseSim.selected.ev / this.caseUnitCost) * 100) - 100;
  }

  simAberturas(qtd: number) {
    if (!this.caseSim.selected) return;
    this.caseSim.simLoading = true;
    const c = this.caseSim.selected;
    const unitCost = this.caseUnitCost;
    const totalCost = unitCost * qtd;

    // CS2 drop probabilities
    const RARITIES = [
      { name: 'Azul (Mil-Spec)',    prob: 0.7992, minVal: 0.05,  maxVal: 1.50,  color: '#4a90e2' },
      { name: 'Roxo (Restricted)',  prob: 0.1598, minVal: 0.80,  maxVal: 8.00,  color: '#8847ff' },
      { name: 'Rosa (Classified)',  prob: 0.032,  minVal: 3.00,  maxVal: 30.00, color: '#d32ce6' },
      { name: 'Vermelho (Covert)',  prob: 0.0064, minVal: 10.00, maxVal: 150.00,color: '#eb4b4b' },
      { name: '★ Faca / Luva',     prob: 0.0026, minVal: 80.00, maxVal: 800.00,color: '#e4ae39' },
    ];

    const drops: { rarity: string; value: number; color: string }[] = [];
    let totalReturn = 0;
    const counts: number[] = [0, 0, 0, 0, 0];

    for (let i = 0; i < qtd; i++) {
      const rand = Math.random();
      let cumulative = 0;
      for (let r = 0; r < RARITIES.length; r++) {
        cumulative += RARITIES[r].prob;
        if (rand <= cumulative || r === RARITIES.length - 1) {
          const val = RARITIES[r].minVal + Math.random() * (RARITIES[r].maxVal - RARITIES[r].minVal);
          drops.push({ rarity: RARITIES[r].name, value: val, color: RARITIES[r].color });
          totalReturn += val;
          counts[r]++;
          break;
        }
      }
    }

    const profit = totalReturn - totalCost;
    const roi = (totalReturn / totalCost * 100) - 100;
    const bestDrop = drops.reduce((a, b) => a.value > b.value ? a : b);

    this.caseSim.simResult = { qtd, totalCost, totalReturn, profit, roi, counts, RARITIES, bestDrop };
    this.caseSim.simLoading = false;
  }


  // ── FORUM ──────────────────────────────────────────────────────
  forumPosts: any[] = [];
  forumLoading: boolean = false;
  forumError: string = '';
  activeForumTag: string = '';
  forumSort: string = 'recent';
  selectedPost: any = null;
  postViewOpen: boolean = false;
  newPostModalOpen: boolean = false;
  newPostTitle: string = '';
  newPostContent: string = '';
  newPostCategory: string = 'Novato';
  newPostTags: string[] = [];
  FORUM_TAGS = ['CS2','Steam','ETF','Ações','Cripto','Imóveis','Rendas','FIRE','Poupança','IRS','Portugal','Novato','Binance','Kraken','Trading 212'];
  newCommentText: string = '';
  submittingPost: boolean = false;
  submittingComment: boolean = false;

  loadForumPosts() {
    this.forumLoading = true;
    this.forumError = '';
    const params = new URLSearchParams({ sort: this.forumSort });
    if (this.activeForumTag) params.set('tag', this.activeForumTag);
    const token = localStorage.getItem('wealthsphere_access_token');
    fetch(`${environment.apiUrl}/forum?${params}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    .then(r => r.json())
    .then(data => { this.forumPosts = Array.isArray(data) ? data : []; this.forumLoading = false; })
    .catch(() => { this.forumError = 'Erro ao carregar posts'; this.forumLoading = false; });
  }

  openPost(post: any) {
    const token = localStorage.getItem('wealthsphere_access_token');
    fetch(`${environment.apiUrl}/forum/${post._id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    .then(r => r.json())
    .then(full => { this.selectedPost = full; this.postViewOpen = true; })
    .catch(() => { this.selectedPost = post; this.postViewOpen = true; });
  }

  closePost() { this.postViewOpen = false; this.selectedPost = null; this.newCommentText = ''; }

  votePost(post: any, dir: string, event: Event) {
    event.stopPropagation();
    const token = localStorage.getItem('wealthsphere_access_token');
    fetch(`${environment.apiUrl}/forum/${post._id}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: dir })
    })
    .then(r => r.json())
    .then(data => { post.votes = data.votes; });
  }

  togglePostTag(tag: string) {
    const idx = this.newPostTags.indexOf(tag);
    if (idx >= 0) { this.newPostTags.splice(idx, 1); }
    else if (this.newPostTags.length < 3) { this.newPostTags.push(tag); }
  }

  submitPost() {
    if (!this.newPostTitle.trim() || !this.newPostContent.trim()) return;
    this.submittingPost = true;
    const token = localStorage.getItem('wealthsphere_access_token');
    fetch(`${environment.apiUrl}/forum`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: this.newPostTitle, content: this.newPostContent, category: this.newPostCategory, tags: this.newPostTags })
    })
    .then(r => r.json())
    .then(post => {
      if (post._id) { this.forumPosts.unshift(post); }
      this.newPostModalOpen = false;
      this.newPostTitle = ''; this.newPostContent = ''; this.newPostTags = [];
      this.submittingPost = false;
    })
    .catch(() => { this.submittingPost = false; });
  }

  submitComment() {
    if (!this.newCommentText.trim() || !this.selectedPost) return;
    this.submittingComment = true;
    const token = localStorage.getItem('wealthsphere_access_token');
    fetch(`${environment.apiUrl}/forum/${this.selectedPost._id}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: this.newCommentText })
    })
    .then(r => r.json())
    .then(updated => {
      this.selectedPost = updated;
      const idx = this.forumPosts.findIndex((p: any) => p._id === updated._id);
      if (idx >= 0) this.forumPosts[idx] = updated;
      this.newCommentText = ''; this.submittingComment = false;
    })
    .catch(() => { this.submittingComment = false; });
  }

  filterForumTag(tag: string) {
    this.activeForumTag = this.activeForumTag === tag ? '' : tag;
    this.loadForumPosts();
  }

  forumTimeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff/60)}m`;
    if (diff < 86400) return `há ${Math.floor(diff/3600)}h`;
    return `há ${Math.floor(diff/86400)}d`;
  }

  authorInitial(name: string): string { return (name || 'U').charAt(0).toUpperCase(); }

  get forumPostsWithComments(): number { return this.forumPosts.filter((p: any) => p.comments?.length > 0).length; }
  get forumPostsWithoutComments(): number { return this.forumPosts.filter((p: any) => !p.comments?.length).length; }

  private readonly _avatarPalette = ['#c0694a','#6a9c6e','#7c6faa','#c8a94a','#4a8ec0','#c06a8a'];
  get dashTrendingPosts(): any[] {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.forumPosts
      .filter((p: any) => new Date(p.createdAt).getTime() >= cutoff)
      .map((p: any) => {
        const name: string = p.authorName || 'U';
        const idx = name.charCodeAt(0) % this._avatarPalette.length;
        return { ...p, _avatarLetter: name[0].toUpperCase(), _avatarColor: this._avatarPalette[idx] };
      })
      .sort((a: any, b: any) => ((b.likes || 0) + (b.comments?.length || 0)) - ((a.likes || 0) + (a.comments?.length || 0)))
      .slice(0, 3);
  }

  // ── END FORUM ──────────────────────────────────────────────────

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

  private drawPatrimonioChart(chartData: any) {
    if (!this.chartCanvas) return;
    this.chartCurrentData = chartData;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth || 800;
    const H = 220;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { t: 16, r: 20, b: 28, l: 52 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    const COLORS = [
      { key: 'networth', color: '#e8813a', label: 'Net Worth' },
      { key: 'etf',      color: '#8b80c8', label: 'ETF' },
      { key: 'rendas',   color: '#4a9e6b', label: 'Rendas' },
      { key: 'steam',    color: '#c9a84c', label: 'Steam' },
      { key: 'savings',  color: '#7a9ab5', label: 'Poupança' },
    ];
    const datasets = COLORS.map(c => ({ ...c, data: (chartData[c.key] || []) as number[] }))
                           .filter(d => d.data.length > 0 && d.data.some(v => v > 0));
    if (!datasets.length) return;

    const allVals = datasets.flatMap(d => d.data);
    const rawMax = Math.max(...allVals);
    const rawMin = Math.min(0, Math.min(...allVals));
    const range = rawMax - rawMin || 1;
    const maxV = rawMax + range * 0.08;
    const minV = rawMin - range * 0.03;
    const n = datasets[0].data.length;
    const labels: string[] = chartData.labels || [];

    const xOf = (i: number) => pad.l + (i / Math.max(n - 1, 1)) * cW;
    const yOf = (v: number) => pad.t + cH - ((v - minV) / (maxV - minV)) * cH;

    // ── Grid lines ──
    const gridCount = 4;
    for (let g = 0; g <= gridCount; g++) {
      const y = pad.t + (g / gridCount) * cH;
      const val = maxV - (g / gridCount) * (maxV - minV);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + cW, y);
      ctx.stroke();
      // Y label
      const label = val >= 1000 ? '€' + (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k' : '€' + val.toFixed(0);
      ctx.fillStyle = 'rgba(180,160,130,0.55)';
      ctx.font = '10px DM Sans,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, pad.l - 6, y + 3.5);
    }

    // ── X labels ──
    ctx.fillStyle = 'rgba(180,160,130,0.55)';
    ctx.font = '10px DM Sans,sans-serif';
    ctx.textAlign = 'center';
    const maxShow = Math.min(labels.length, 7);
    for (let k = 0; k < maxShow; k++) {
      const idx = Math.round(k * (labels.length - 1) / Math.max(maxShow - 1, 1));
      ctx.fillText(labels[idx] || '', xOf(idx), H - 5);
    }

    // ── Smooth bezier path helper (Catmull-Rom → cubic bezier) ──
    const smoothPath = (pts: [number, number][]) => {
      if (pts.length < 2) return;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const tension = 0.18;
        const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
        const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
        const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
        const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
    };

    // ── Draw areas (back → front, reversed so NetWorth is on top) ──
    [...datasets].reverse().forEach(ds => {
      const pts: [number, number][] = ds.data.map((v, i) => [xOf(i), yOf(v)]);
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
      grad.addColorStop(0, ds.color + '22');
      grad.addColorStop(1, ds.color + '02');
      ctx.beginPath();
      smoothPath(pts);
      ctx.lineTo(xOf(n - 1), pad.t + cH);
      ctx.lineTo(xOf(0), pad.t + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // ── Draw lines (front) ──
    datasets.forEach(ds => {
      const pts: [number, number][] = ds.data.map((v, i) => [xOf(i), yOf(v)]);
      ctx.beginPath();
      smoothPath(pts);
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = ds.key === 'networth' ? 2.5 : 1.5;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();
      // End-point dot for net worth
      if (ds.key === 'networth' && pts.length > 0) {
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
        ctx.fillStyle = ds.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // ── Hover tooltip ──
    const tooltip = this.chartTooltip?.nativeElement;
    const container = canvas.parentElement;
    if (!tooltip || !container) return;

    // Remove old listeners
    if (this.chartMouseHandler) canvas.removeEventListener('mousemove', this.chartMouseHandler);
    if (this.chartLeaveHandler) canvas.removeEventListener('mouseleave', this.chartLeaveHandler);

    this.chartMouseHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (mx < pad.l || mx > pad.l + cW) { tooltip.style.display = 'none'; return; }

      // Find closest data index
      const rawIdx = (mx - pad.l) / cW * (n - 1);
      const idx = Math.min(Math.max(Math.round(rawIdx), 0), n - 1);
      const xPos = xOf(idx);

      // Draw crosshair overlay
      ctx.clearRect(0, 0, W, H);
      // Redraw grid
      for (let g = 0; g <= gridCount; g++) {
        const y = pad.t + (g / gridCount) * cH;
        const val = maxV - (g / gridCount) * (maxV - minV);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cW, y); ctx.stroke();
        const lbl = val >= 1000 ? '€' + (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'k' : '€' + val.toFixed(0);
        ctx.fillStyle = 'rgba(180,160,130,0.55)';
        ctx.font = '10px DM Sans,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(lbl, pad.l - 6, y + 3.5);
      }
      ctx.fillStyle = 'rgba(180,160,130,0.55)';
      ctx.font = '10px DM Sans,sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < maxShow; k++) {
        const i2 = Math.round(k * (labels.length - 1) / Math.max(maxShow - 1, 1));
        ctx.fillText(labels[i2] || '', xOf(i2), H - 5);
      }
      // Areas
      [...datasets].reverse().forEach(ds => {
        const pts: [number, number][] = ds.data.map((v, i) => [xOf(i), yOf(v)]);
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
        grad.addColorStop(0, ds.color + '22');
        grad.addColorStop(1, ds.color + '02');
        ctx.beginPath(); smoothPath(pts);
        ctx.lineTo(xOf(n - 1), pad.t + cH); ctx.lineTo(xOf(0), pad.t + cH); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill();
      });
      datasets.forEach(ds => {
        const pts: [number, number][] = ds.data.map((v, i) => [xOf(i), yOf(v)]);
        ctx.beginPath(); smoothPath(pts);
        ctx.strokeStyle = ds.color;
        ctx.lineWidth = ds.key === 'networth' ? 2.5 : 1.5;
        ctx.lineJoin = 'round'; ctx.setLineDash([]); ctx.stroke();
        if (ds.key === 'networth' && pts.length > 0) {
          const last = pts[pts.length - 1];
          ctx.beginPath(); ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
          ctx.fillStyle = ds.color; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      });
      // Crosshair line
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(xPos, pad.t); ctx.lineTo(xPos, pad.t + cH); ctx.stroke();
      ctx.setLineDash([]);
      // Dots at intersection
      datasets.forEach(ds => {
        const v = ds.data[idx];
        if (v === undefined) return;
        const cy = yOf(v);
        ctx.beginPath(); ctx.arc(xPos, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = ds.color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      });

      // Tooltip HTML
      const lines = datasets.map(ds => {
        const v = ds.data[idx] || 0;
        return `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="width:8px;height:8px;border-radius:50%;background:${ds.color};display:inline-block;flex-shrink:0"></span>
          <span style="color:rgba(200,180,150,0.7);min-width:60px">${ds.label}</span>
          <span style="font-weight:600;color:#e8d5b0">€${v.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>`;
      }).join('');
      tooltip.innerHTML = `<div style="font-weight:700;color:#c9a84c;margin-bottom:6px;font-size:11px">${labels[idx] || ''}</div>${lines}`;
      tooltip.style.display = 'block';
      // Position tooltip: prefer right side, flip left near edge
      const ttW = 200;
      let left = xPos + 12;
      if (left + ttW > W - 8) left = xPos - ttW - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = Math.max(pad.t, Math.min(my - 20, H - 120)) + 'px';
    };

    this.chartLeaveHandler = () => {
      tooltip.style.display = 'none';
    };

    canvas.addEventListener('mousemove', this.chartMouseHandler as EventListener);
    canvas.addEventListener('mouseleave', this.chartLeaveHandler as EventListener);
  }

  openWatchlistChart(item: any) {
    this.selectedWlItem = item;
    this.wlChartModalOpen = true;
  }

  closeWlChart() {
    this.wlChartModalOpen = false;
    this.selectedWlItem = null;
  }

  setWlTimeframe(t: string) {
    this.selectedWlTimeframe = t;
  }
  // ── Simulator methods ────────────────────────────────────────────────
  setCaseCategory(cat: string) { this.caseCategory = cat; }

  setSimTab(tab: string) { this.currentSimTab = tab; this.simView = 'details'; }
  goBackToSimGrid() { this.simView = 'grid'; }

  addToWatchlist() {
    if (!this.invSelectedStock) return;
    this.toggleWatch(this.invSelectedStock);
  }

  calcJuros() {
    const { principal, monthly, rate, years } = this.simJuros;
    const r = rate / 100 / 12;
    const n = years * 12;
    const futureValue = principal * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
    const invested = principal + monthly * n;
    this.simJuros.results = {
      total: Math.round(futureValue),
      invested: Math.round(invested),
      profit: Math.round(futureValue - invested)
    };
  }

  calcCH() {
    const { amount, years, euribor, spread } = this.simCH;
    const taxa = (euribor + spread) / 100 / 12;
    const n = years * 12;
    const prestacao = taxa === 0 ? amount / n : amount * taxa / (1 - Math.pow(1 + taxa, -n));
    const totalJuros = prestacao * n - amount;
    this.simCH.results = {
      prestacao: Math.round(prestacao * 100) / 100,
      totalJuros: Math.round(totalJuros),
      taeg: Math.round((euribor + spread + 0.1) * 100) / 100
    };
  }

  calcMonthlyPayment(amount: number, annualRate: number, months: number): number {
    const r = annualRate / 100 / 12;
    if (r === 0) return amount / months;
    return Math.round((amount * r / (1 - Math.pow(1 + r, -months))) * 100) / 100;
  }

  calcFIRE() {
    const { gastos, currentWealth, savings, return: ret } = this.simFIRE;
    const target = gastos * 12 * 25; // 4% rule
    const r = ret / 100 / 12;
    let wealth = currentWealth;
    let months = 0;
    const maxMonths = 600;
    while (wealth < target && months < maxMonths) {
      wealth = wealth * (1 + r) + savings;
      months++;
    }
    const fireDate = new Date();
    fireDate.setMonth(fireDate.getMonth() + months);
    this.simFIRE.results = {
      target: Math.round(target),
      yearsToFire: months < maxMonths ? Math.round(months / 12 * 10) / 10 : 999,
      fireDate: months < maxMonths ? fireDate.getFullYear().toString() : '--'
    };
  }

  calcRendas() {
    const { valorImovel, renda, prestacao, despesas } = this.simRendas;
    const rendaAnual = renda * 12;
    const yieldBruto = valorImovel > 0 ? rendaAnual / valorImovel * 100 : 0;
    const cashflow = renda - prestacao - despesas;
    const custoAnual = (prestacao + despesas) * 12;
    const yieldLiquido = valorImovel > 0 ? (rendaAnual - custoAnual) / valorImovel * 100 : 0;
    const payback = cashflow > 0 ? Math.round(valorImovel / (cashflow * 12)) : 0;
    this.simRendas.results = {
      yieldBruto: Math.round(yieldBruto * 100) / 100,
      yieldLiquido: Math.round(yieldLiquido * 100) / 100,
      cashflow: Math.round(cashflow),
      payback
    };
  }

  calcInflacao() {
    const { valor, taxa, anos, retorno } = this.simInflacao;
    const valorFuturoInflacao = valor * Math.pow(1 + taxa / 100, anos);
    const ganhoInvestimento = valor * Math.pow(1 + retorno / 100, anos);
    const retornoReal = ((1 + retorno / 100) / (1 + taxa / 100) - 1) * 100;
    this.simInflacao.results = {
      valorFuturoInflacao: Math.round(valorFuturoInflacao),
      perdaPoderCompra: Math.round(valorFuturoInflacao - valor),
      ganhoInvestimento: Math.round(ganhoInvestimento),
      retornoReal: Math.round(retornoReal * 100) / 100
    };
  }

  calcSimAll() {
    this.calcJuros();
    this.calcCH();
    this.calcFIRE();
    this.calcRendas();
    this.calcInflacao();
  }

  loadDashNews(topicKey?: string) {
    if (topicKey) this.dashNewsTopic = topicKey;
    const topic = this.dashNewsTopics.find(t => t.key === this.dashNewsTopic);
    if (!topic) return;
    this.dashNewsLoading = true;
    this.dashNewsItems = [];
    this.userService.getStockNews(topic.symbol).subscribe({
      next: (items: any[]) => {
        this.dashNewsItems = items.slice(0, 8);
        this.dashNewsLoading = false;
      },
      error: () => { this.dashNewsLoading = false; }
    });
  }

  openDashNewsItem(item: any) { this.dashNewsOpenItem = item; }
  closeDashNewsItem() { this.dashNewsOpenItem = null; }
  postTimeAgo(createdAt: string): string { return this.dashNewsTimeAgo(Math.floor(new Date(createdAt).getTime() / 1000)); }

  dashNewsTimeAgo(ts: number): string {
    const diff = Date.now() - ts * 1000;
    const m = Math.floor(diff / 60000);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'd';
  }

  get recentFeedItems(): any[] {
    const items: any[] = [];
    const alerts = JSON.parse(localStorage.getItem('ws_price_alerts') || '[]');
    for (const a of alerts) {
      if (a.triggered) {
        items.push({ type: 'alert', label: a.symbol || a.itemName, msg: 'Alerta disparado: ' + (a.symbol || a.itemName), ts: a.triggeredAt || 0 });
      }
    }
    return items.sort((a: any, b: any) => b.ts - a.ts).slice(0, 10);
  }

  checkGoalNotifications() {
    const netWorth = this.calculatedNetWorth;
    for (const g of this.goals) {
      if (netWorth >= g.target && !g.notified) {
        g.notified = true;
        const key = 'ws_notifications';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift({
          id: Date.now(), type: 'goal',
          title: 'Meta atingida! 🎉',
          msg: `A meta "${g.label}" foi atingida (€${g.target.toLocaleString()})`,
          ts: Date.now(), read: false
        });
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
        this.notifications = existing.filter((n: any) => !n.read);
      }
    }
    localStorage.setItem('ws_goals', JSON.stringify(this.goals));
  }
}

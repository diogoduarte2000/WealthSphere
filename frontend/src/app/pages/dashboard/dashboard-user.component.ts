// v2
import { Component, AfterViewInit, ElementRef, ViewChild, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  userNationality: string = 'pt';

  readonly nationalityMap: Record<string, { flag: string; label: string }> = {
    pt: { flag: '🇵🇹', label: 'Portugal' },
    br: { flag: '🇧🇷', label: 'Brasil' },
    en: { flag: '🇬🇧', label: 'United Kingdom' },
    gb: { flag: '🇬🇧', label: 'United Kingdom' },
    us: { flag: '🇺🇸', label: 'United States' },
    fr: { flag: '🇫🇷', label: 'France' },
    de: { flag: '🇩🇪', label: 'Deutschland' },
    es: { flag: '🇪🇸', label: 'España' },
    it: { flag: '🇮🇹', label: 'Italia' },
    nl: { flag: '🇳🇱', label: 'Nederland' },
    ch: { flag: '🇨🇭', label: 'Schweiz' },
    ie: { flag: '🇮🇪', label: 'Ireland' },
    pl: { flag: '🇵🇱', label: 'Polska' },
    ro: { flag: '🇷🇴', label: 'România' },
    se: { flag: '🇸🇪', label: 'Sverige' },
    be: { flag: '🇧🇪', label: 'België' },
    at: { flag: '🇦🇹', label: 'Österreich' },
    ca: { flag: '🇨🇦', label: 'Canada' },
    au: { flag: '🇦🇺', label: 'Australia' },
    jp: { flag: '🇯🇵', label: 'Japan' },
    other: { flag: '🌍', label: 'Outro' }
  };

  get userNationalityDisplay(): string {
    const n = this.nationalityMap[this.userNationality];
    return n ? `${n.flag} ${n.label}` : '🌍 —';
  }

  // New Variables for Rendas Internal Tabs
  currentRendasTab: string = 'imoveis';

  // ── Toast notifications ─────────────────────────────────────────────
  toasts: { id: number; msg: string; type: 'success' | 'error' | 'info' }[] = [];
  private _toastId = 0;
  toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++this._toastId;
    this.toasts.push({ id, msg, type });
    setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 3500);
  }

  titles: { [key: string]: [string, string] } = {
    dashboard: ['Dashboard', this.getTodaySubtitle()],
    income: ['Income Tracker', ''],
    taxas: ['Taxas & Mercados', 'Dados em tempo real · BCE · Banco de Portugal'],
    cs2: ['CS2 & Steam', 'Inventário Steam sincronizado'],
    comunidade: ['Comunidade', 'Partilha e discute finanças pessoais'],
    rendas: ['Rendas & Imóveis', 'Gestão do teu portfólio imobiliário'],
    'add-renda': ['Adicionar Imóvel', 'Adiciona um novo ativo imobiliário à tua carteira'],
    simulador: ['Simulador', 'Juros compostos · FIRE · Amortizações'],
    investimentos: ['Investimentos', 'Portfólio Trading 212 · Pesquisar ações'],
    cripto: ['Cripto', 'Portfólio de criptomoedas · Binance + Trading 212'],
    perfil: ['Perfil', ''],
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
  t212ChartMode: 'line' | 'candle' = 'line';
  @ViewChild('t212ChartCanvas') t212ChartCanvas: any;
  @ViewChild('t212Tooltip') t212TooltipEl: any;
  @ViewChild('t212TreemapCanvas') t212TreemapCanvas: any;
  @ViewChild('t212TreemapTooltip') t212TreemapTooltipEl: any;
  private t212MouseHandler: ((e: MouseEvent) => void) | null = null;
  private t212LeaveHandler: (() => void) | null = null;

  private snapPosVal(s: any): number {
    if (!s) return 0;
    // Use the same ceiling as the chart: cap at 3× current positions value to reject corrupted snapshots
    const ceiling = Math.max((this.t212Portfolio?.positionsValue || 0) * 3, 500);
    if (s.positionsValue > 0 && s.positionsValue < ceiling) return s.positionsValue;
    const fromParts = (s.invested || 0) + (s.result || 0);
    return (fromParts > 0 && fromParts < ceiling) ? fromParts : 0;
  }

  get t212HistoryGain(): number {
    if (this.t212History.length < 2) return 0;
    const last  = this.t212History[this.t212History.length - 1];
    // Use the most recent valid snapshot for the first value
    const first = this.t212History.find((s: any) => this.snapPosVal(s) > 0) || this.t212History[0];
    return this.snapPosVal(last) - this.snapPosVal(first);
  }

  get t212HistoryGainPct(): number {
    const first = this.t212History.find((s: any) => this.snapPosVal(s) > 0) || this.t212History[0];
    const firstVal = this.snapPosVal(first);
    if (firstVal === 0) return 0;
    return (this.t212HistoryGain / firstVal) * 100;
  }

  loadT212History() {
    this.userService.getT212History(this.t212HistoryDays).subscribe({
      next: (data: any) => {
        const real: any[] = data.snapshots || [];
        const totalPortfolio = this.t212Portfolio?.total || 0;
        // Use positionsValue so the chart reflects actual investment performance
        // (excludes uninvested cash which would dwarf the positions line)
        const posVal = this.t212Portfolio?.positionsValue || 0;
        const base   = posVal > 0 ? posVal : totalPortfolio;
        const inv    = this.t212Portfolio?.invested || 0;

        // Use real data only if we have good coverage (≥30% of selected period)
        if (real.length >= Math.max(7, this.t212HistoryDays * 0.3)) {
          this.t212History = real;
        } else if (base > 0) {
          // Build a realistic demo curve covering the full selected period
          const days = this.t212HistoryDays;
          const now  = new Date();
          // Use cost basis (invested) as starting point, ramp to current positionsValue
          const costBasis = inv > 0 ? inv : base * 0.85;

          this.t212History = Array.from({ length: days }, (_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() - (days - 1 - i));
            const r = i / (days - 1);
            const ease = r < 0.5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2;
            // Realistic ETF noise (weekly oscillation + micro noise)
            const noise = 1
              + Math.sin(i * 0.45) * 0.018
              + Math.sin(i * 1.3)  * 0.008
              + Math.sin(i * 3.7)  * 0.003;
            const posValue = costBasis + (base - costBasis) * ease * noise;
            return {
              date: d.toISOString().slice(0, 10),
              total: +posValue.toFixed(2),
              positionsValue: +posValue.toFixed(2),
              invested: inv > 0 ? +(inv * (0.92 + 0.08 * ease)).toFixed(2) : 0,
              source: 'demo'
            };
          });

          // Overlay any real snapshots we do have
          real.forEach((snap: any) => {
            const idx = this.t212History.findIndex((h: any) => h.date === snap.date);
            if (idx >= 0) this.t212History[idx] = { ...snap, source: 'real' };
          });

          // Pin the last point to the actual current positionsValue
          const last = this.t212History[this.t212History.length - 1];
          last.total = base;
          last.positionsValue = base;
          if (inv > 0) last.invested = inv;
        } else {
          this.t212History = real;
        }
        setTimeout(() => this.drawT212Chart(), 50);
      },
      error: () => {}
    });
  }

  drawT212Chart() {
    if (this.t212ChartMode === 'candle') {
      this.drawT212Candle();
    } else {
      this.drawT212Line();
    }
  }

  /** Generate pseudo-OHLC from daily close values (realistic synthetic intraday range) */
  private t212Ohlc(): {date:string,o:number,h:number,l:number,c:number}[] {
    const data = this.t212History;
    return data.map((d: any, i: number) => {
      const c = d.total || 0;
      const o = i > 0 ? (data[i - 1].total || c) : c;
      // Daily range ~0.4–1.0% of value, deterministic per index
      const rng = c * 0.007 * (0.4 + 0.6 * Math.abs(Math.sin(i * 5.3 + 1.1)));
      const h = Math.max(o, c) + rng * (0.4 + 0.3 * Math.abs(Math.sin(i * 2.7)));
      const l = Math.min(o, c) - rng * (0.4 + 0.3 * Math.abs(Math.cos(i * 3.1)));
      return { date: d.date || '', o, h, l, c };
    });
  }

  drawT212Candle() {
    if (!this.t212ChartCanvas || this.t212History.length < 2) return;
    const canvas = this.t212ChartCanvas.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 800;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const pad = { t: 14, b: 28, l: 54, r: 16 };
    const ohlc = this.t212Ohlc();
    const n = ohlc.length;
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    const allLows  = ohlc.map(c => c.l);
    const allHighs = ohlc.map(c => c.h);
    const rawMin = Math.min(...allLows);
    const rawMax = Math.max(...allHighs);
    const range = rawMax - rawMin || 1;
    const minV = rawMin - range * 0.04;
    const maxV = rawMax + range * 0.08;

    const slotW = cW / n;
    const bodyW = Math.max(1, Math.min(slotW * 0.7, 12));
    const xOf = (i: number) => pad.l + (i + 0.5) * slotW;
    const yOf = (v: number) => pad.t + cH - ((v - minV) / (maxV - minV)) * cH;

    const GREEN = '#4a9e6b';
    const RED   = '#c97b6a';

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

      // X date labels
      const show = Math.min(n, 5);
      ctx.fillStyle = 'rgba(180,160,130,0.55)';
      ctx.font = '10px DM Sans,sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < show; k++) {
        const idx = Math.round(k * (n - 1) / Math.max(show - 1, 1));
        ctx.fillText(ohlc[idx].date.slice(5), xOf(idx), H - 5);
      }

      // Draw candles
      ohlc.forEach((d, i) => {
        const x = xOf(i);
        const bull = d.c >= d.o;
        const col  = bull ? GREEN : RED;
        const yH = yOf(d.h);
        const yL = yOf(d.l);
        const yO = yOf(d.o);
        const yC = yOf(d.c);
        const yTop  = Math.min(yO, yC);
        const yBot  = Math.max(yO, yC);
        const bodyH = Math.max(1, yBot - yTop);

        // Highlight hovered candle
        if (hoverIdx === i) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x - slotW / 2, pad.t, slotW, cH);
        }

        // Wick
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yH);
        ctx.lineTo(x, yL);
        ctx.stroke();

        // Body
        ctx.fillStyle = bull ? col + 'CC' : col + 'CC';
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.8;
        ctx.fillRect(x - bodyW / 2, yTop, bodyW, bodyH);
        ctx.strokeRect(x - bodyW / 2, yTop, bodyW, bodyH);
      });

      // Hover crosshair
      if (hoverIdx !== null) {
        const xPos = xOf(hoverIdx);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xPos, pad.t); ctx.lineTo(xPos, pad.t + cH); ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    redraw(null);

    // Tooltip
    const tooltip = this.t212TooltipEl?.nativeElement;
    if (!tooltip) return;
    if (this.t212MouseHandler) canvas.removeEventListener('mousemove', this.t212MouseHandler);
    if (this.t212LeaveHandler) canvas.removeEventListener('mouseleave', this.t212LeaveHandler);

    this.t212MouseHandler = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      if (mx < pad.l || mx > pad.l + cW) { tooltip.style.display = 'none'; redraw(null); return; }
      const idx = Math.min(Math.max(Math.floor((mx - pad.l) / slotW), 0), n - 1);
      redraw(idx);
      const d = ohlc[idx];
      const bull = d.c >= d.o;
      const gainCol = bull ? '#4a9e6b' : '#c97b6a';
      const pct = d.o > 0 ? ((d.c - d.o) / d.o * 100) : 0;
      tooltip.innerHTML = `
        <div style="font-weight:700;color:#c9a84c;margin-bottom:6px;font-size:11px">${d.date}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:11px">
          <span style="color:rgba(200,180,150,0.6)">Abertura</span><span style="color:#e8d5b0;font-weight:600">€${d.o.toFixed(2)}</span>
          <span style="color:rgba(200,180,150,0.6)">Máximo</span><span style="color:#e8d5b0;font-weight:600">€${d.h.toFixed(2)}</span>
          <span style="color:rgba(200,180,150,0.6)">Mínimo</span><span style="color:#e8d5b0;font-weight:600">€${d.l.toFixed(2)}</span>
          <span style="color:rgba(200,180,150,0.6)">Fecho</span><span style="color:#e8d5b0;font-weight:600">€${d.c.toFixed(2)}</span>
        </div>
        <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(201,168,76,0.15);font-size:10px;color:${gainCol}">
          ${bull ? '▲' : '▼'} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%
        </div>`;
      tooltip.style.display = 'block';
      const ttW = 180;
      let left = xOf(idx) + 12;
      if (left + ttW > W - 8) left = xOf(idx) - ttW - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = (pad.t + 4) + 'px';
    };
    this.t212LeaveHandler = () => { tooltip.style.display = 'none'; redraw(null); };
    canvas.addEventListener('mousemove', this.t212MouseHandler);
    canvas.addEventListener('mouseleave', this.t212LeaveHandler);
  }

  drawT212Line() {
    if (!this.t212ChartCanvas || this.t212History.length < 2) return;
    const canvas = this.t212ChartCanvas.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 800;
    const H = 200;
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

    // Derive positions value: new snapshots have positionsValue; for old ones use invested+result
    // (invested = cost basis, result = unrealised P&L, both in EUR). Never use cash-inflated total.
    // Sanity ceiling: some old snapshots had result=total (bug) — cap to 3× current positions value.
    const posCeiling = Math.max((this.t212Portfolio?.positionsValue || 0) * 3, 500);
    const posValOf = (s: any) => {
      if (s.positionsValue > 0 && s.positionsValue < posCeiling) return s.positionsValue;
      const fromParts = (s.invested || 0) + (s.result || 0);
      if (fromParts > 0 && fromParts < posCeiling) return fromParts;
      return 0; // unknown or corrupted snapshot; skip
    };
    const totalVals = data.map((s: any) => posValOf(s));
    // Only include invested values where we have a valid reading (skip corrupted snapshots)
    const investedVals = data.map((s: any) => {
      const inv = s.invested || 0;
      return (inv > 0 && inv < posCeiling) ? inv : 0;
    });
    // Filter out zeros (snapshots that don't have derivable positions data)
    const nonZeroTotal = totalVals.filter((v: number) => v > 0);
    const allVals = [...nonZeroTotal, ...investedVals.filter((v: number) => v > 0)];
    if (allVals.length === 0) return; // nothing to draw
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
        const t = 0.15;
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

      // X date labels
      const dates = data.map((s: any) => (s.date || '').slice(5));
      const show = Math.min(n, 5);
      ctx.fillStyle = 'rgba(180,160,130,0.55)';
      ctx.font = '10px DM Sans,sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < show; k++) {
        const idx = Math.round(k * (n - 1) / Math.max(show - 1, 1));
        ctx.fillText(dates[idx], xOf(idx), H - 5);
      }

      // Invested dashed line — draw as segmented line, skip points with no data (inv=0)
      const hasInvested = investedVals.some((v: number) => v > 0);
      if (hasInvested) {
        ctx.beginPath();
        let inSegment = false;
        investedVals.forEach((v: number, i: number) => {
          if (v > 0) {
            const px = xOf(i), py = yOf(v);
            if (!inSegment) { ctx.moveTo(px, py); inSegment = true; }
            else ctx.lineTo(px, py);
          } else {
            inSegment = false; // break path on missing data
          }
        });
        ctx.strokeStyle = 'rgba(201,168,76,0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Total area fill — only use non-zero points (zeros = unknown snapshots)
      const tptsAll = totalVals.map((v: number, i: number) => ({ v, x: xOf(i), y: v > 0 ? yOf(v) : null }));
      // Forward-fill zero values so the line stays connected
      let lastKnownY = yOf(nonZeroTotal[0] || rawMin);
      const tpts: [number, number][] = tptsAll.map(pt => {
        if (pt.y !== null) { lastKnownY = pt.y; return [pt.x, pt.y] as [number, number]; }
        return [pt.x, lastKnownY] as [number, number];
      });
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + cH);
      grad.addColorStop(0, color + '35');
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
      const lastPt = tpts[tpts.length - 1];
      ctx.beginPath();
      ctx.arc(lastPt[0], lastPt[1], 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();

      // Hover crosshair
      if (hoverIdx !== null) {
        const xPos = xOf(hoverIdx);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xPos, pad.t); ctx.lineTo(xPos, pad.t + cH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(xPos, yOf(totalVals[hoverIdx]), 5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
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
      const posVal = posValOf(s);
      const firstSnap = data.find((d: any) => posValOf(d) > 0) || data[0];
      const firstPosVal = posValOf(firstSnap);
      const gain = posVal - firstPosVal;
      const gainSign = gain >= 0 ? '+' : '';
      const invLine = s.invested > 0
        ? `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:8px;height:8px;border-radius:50%;background:#c9a84c;display:inline-block"></span><span style="color:rgba(200,180,150,0.7);min-width:68px">Custo base</span><span style="font-weight:600;color:#e8d5b0">€${s.invested.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>` : '';
      tooltip.innerHTML = `
        <div style="font-weight:700;color:#c9a84c;margin-bottom:6px;font-size:11px">${s.date || ''}</div>
        <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
          <span style="color:rgba(200,180,150,0.7);min-width:68px">Em Ações</span>
          <span style="font-weight:600;color:#e8d5b0">€${posVal.toLocaleString('pt-PT', {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        ${invLine}
        <div style="margin-top:5px;padding-top:5px;border-top:1px solid rgba(201,168,76,0.15);font-size:10px">
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

  /** Draw squarified treemap of T212 positions by value */
  drawT212Treemap() {
    const positions = this.t212Portfolio?.positions;
    if (!positions?.length || !this.t212TreemapCanvas) return;

    const canvas = this.t212TreemapCanvas.nativeElement;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 420;
    // Taller aspect ratio for the sidebar column — roughly square
    const H = Math.max(320, Math.min(600, W * 0.9));
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Build items: use positionsValue for sizing
    const items = positions
      .map((p: any) => ({
        ticker: this.cleanTicker(p.ticker || ''),
        name: p.fullName || p.ticker || '',
        value: Math.max(0, p.currentValue || p.walletImpact?.currentValue || 0),
        ppl: p.ppl || p.walletImpact?.unrealizedProfitLoss || 0,
        cost: Math.max(0, (p.currentValue || 0) - (p.ppl || 0)),
      }))
      .filter((i: any) => i.value > 0)
      .sort((a: any, b: any) => b.value - a.value);

    if (!items.length) return;

    // Simple slice-and-dice treemap
    type Rect = { x: number; y: number; w: number; h: number };
    const totalVal = items.reduce((s: number, i: any) => s + i.value, 0);

    function sliceDice(items: any[], rect: Rect, horiz: boolean): { item: any; rect: Rect }[] {
      if (!items.length) return [];
      const result: { item: any; rect: Rect }[] = [];
      const total = items.reduce((s, i) => s + i.value, 0);
      let pos = horiz ? rect.x : rect.y;
      const span = horiz ? rect.w : rect.h;
      const cross = horiz ? rect.h : rect.w;
      items.forEach(item => {
        const size = (item.value / total) * span;
        result.push({
          item,
          rect: horiz
            ? { x: pos, y: rect.y, w: size, h: cross }
            : { x: rect.x, y: pos, w: cross, h: size }
        });
        pos += size;
      });
      return result;
    }

    // Two-level: split columns first (vertical), then each column horizontally
    const COL_COUNT = Math.ceil(Math.sqrt(items.length * (W / H)));
    const cols: any[][] = Array.from({ length: COL_COUNT }, () => []);
    items.forEach((item: any, idx: number) => cols[idx % COL_COUNT].push(item));

    const colW = W / COL_COUNT;
    const rects: { item: any; rect: Rect }[] = [];
    cols.forEach((col, ci) => {
      sliceDice(col, { x: ci * colW, y: 0, w: colW, h: H }, false).forEach(r => rects.push(r));
    });

    const GAP = 2;

    rects.forEach(({ item, rect: r }) => {
      const pct = item.cost > 0 ? (item.ppl / item.cost) * 100 : 0;
      const bull = pct >= 0;

      // Color: green/red gradient intensity by % gain
      const intensity = Math.min(Math.abs(pct) / 5, 1); // saturate at ±5%
      const alpha = 0.25 + intensity * 0.55;
      const baseColor = bull ? `rgba(74,158,107,${alpha})` : `rgba(201,123,106,${alpha})`;
      const borderColor = bull ? `rgba(74,158,107,0.9)` : `rgba(201,123,106,0.9)`;

      const rx = r.x + GAP / 2;
      const ry = r.y + GAP / 2;
      const rw = r.w - GAP;
      const rh = r.h - GAP;

      // Background
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 4);
      ctx.fill();

      // Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 4);
      ctx.stroke();

      // Adaptive labels: 3 tiers by cell size
      ctx.textAlign = 'center';
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;

      const isLarge  = rw > 72 && rh > 60;  // ticker + % + name
      const isMedium = rw > 42 && rh > 36;  // ticker + %
      const isSmall  = rw > 26 && rh > 20;  // ticker only

      if (isLarge || isMedium || isSmall) {
        const showPct  = isMedium;
        const showName = isLarge && rh > 78;
        const fontSize = isLarge ? 13 : isMedium ? 11 : 9;
        const lineH    = fontSize + 4;
        const lines    = showName ? 3 : showPct ? 2 : 1;
        const startY   = cy - ((lines - 1) * lineH) / 2 + fontSize * 0.35;

        ctx.font = `700 ${fontSize}px DM Sans, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(item.ticker.slice(0, isLarge ? 7 : 5), cx, startY);

        if (showPct) {
          const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
          ctx.font = `600 ${Math.max(8, fontSize - 2)}px DM Sans, sans-serif`;
          ctx.fillStyle = bull ? 'rgba(160,255,180,0.9)' : 'rgba(255,160,140,0.9)';
          ctx.fillText(pctStr, cx, startY + lineH);
        }

        if (showName) {
          const shortName = item.name.split(' ').slice(0, 3).join(' ');
          ctx.font = `400 ${Math.max(8, fontSize - 3)}px DM Sans, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText(shortName.slice(0, 18), cx, startY + lineH * 2);
        }
      }
    });

    // Hover tooltip
    const tooltip = this.t212TreemapTooltipEl?.nativeElement;
    if (!tooltip) return;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left);
      const my = (e.clientY - rect.top);
      const hit = rects.find(({ rect: r }) =>
        mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
      );
      if (!hit) { tooltip.style.display = 'none'; return; }
      const { item } = hit;
      const pct = item.cost > 0 ? (item.ppl / item.cost) * 100 : 0;
      const weight = (item.value / totalVal * 100).toFixed(1);
      const gainCol = pct >= 0 ? '#4a9e6b' : '#c97b6a';
      tooltip.innerHTML = `
        <div style="font-weight:700;color:#c9a84c;margin-bottom:4px;font-size:12px">${item.ticker}</div>
        <div style="font-size:11px;color:rgba(200,180,150,0.8);margin-bottom:2px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</div>
        <div style="font-size:11px;color:#e8d5b0;font-weight:600">€${item.value.toFixed(2)}</div>
        <div style="font-size:10px;color:${gainCol};margin-top:3px">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% · ${weight}% carteira</div>`;
      tooltip.style.display = 'block';
      let lx = mx + 12;
      if (lx + 190 > W) lx = mx - 202;
      tooltip.style.left = lx + 'px';
      tooltip.style.top = Math.max(0, my - 20) + 'px';
    };
    const onLeave = () => { tooltip.style.display = 'none'; };
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mouseleave', onLeave);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
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

  resetAlert(alert: any) {
    alert.triggered = false;
    alert.triggeredAt = null;
    localStorage.setItem('ws_price_alerts', JSON.stringify(this.priceAlerts));
  }

  checkAlertPrices() {
    if (!this.priceAlerts.length) return;
    const token = localStorage.getItem('wealthsphere_access_token');
    this.priceAlerts.forEach(alert => {
      if (alert.triggered) return; // already fired, skip
      fetch(`${environment.apiUrl}/external/steam/price?name=${encodeURIComponent(alert.itemName)}&game=cs2`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      .then(r => r.json())
      .then(data => {
        if (data.price != null) {
          alert.currentPrice = data.price;
          const hit = data.price <= alert.targetPrice;
          if (hit && !alert.triggered) {
            alert.triggered = true;
            alert.triggeredAt = Date.now();
            // Push to notification center
            this.notifications.unshift({
              id: Date.now(),
              type: 'price',
              icon: '🎯',
              title: `Alerta CS2: ${alert.itemName}`,
              message: `Preço atingiu €${data.price.toFixed(2)} (alvo: €${alert.targetPrice.toFixed(2)})`,
              time: new Date(),
              read: false
            });
            this.unreadNotifs++;
            // Toast
            this.toast(`🎯 ${alert.itemName} atingiu €${data.price.toFixed(2)}!`, 'success');
            // Browser push notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('WealthSphere — Alerta CS2', {
                body: `${alert.itemName} está a €${data.price.toFixed(2)} (alvo: €${alert.targetPrice.toFixed(2)})`,
                icon: '/favicon.ico'
              });
            }
          }
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
    if (yields.length === 0) return '0,0';
    const avg = yields.reduce((a: number, b: number) => a + b, 0) / yields.length;
    return avg.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  getRentYield(prop: any): string {
    if (!prop.currentValue || prop.currentValue === 0) return '0,0';
    const y = ((prop.rentAmount || 0) * 12 / prop.currentValue) * 100;
    return y.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  userCoinbaseLinked: boolean = false;
  userWiseLinked: boolean = false;
  userPaypalLinked: boolean = false;
  userCreatedAt: Date | null = null;

  // Coinbase modal
  coinbaseModalOpen: boolean = false;
  coinbaseApiKeyInput: string = '';
  coinbaseApiSecretInput: string = '';
  coinbaseSaving: boolean = false;
  coinbaseBalances: any[] = [];
  coinbaseError: string = '';

  // Wise modal
  wiseModalOpen: boolean = false;
  wiseTokenInput: string = '';
  wiseSaving: boolean = false;
  wiseBalances: any[] = [];

  get coinbaseTotalEur(): number {
    return this.coinbaseBalances.reduce((s: number, b: any) => s + (b.valueEur || 0), 0);
  }

  openCoinbaseModal() { this.coinbaseModalOpen = true; this.coinbaseApiKeyInput = ''; this.coinbaseApiSecretInput = ''; }
  closeCoinbaseModal() { this.coinbaseModalOpen = false; }

  saveCoinbaseKeys() {
    if (!this.coinbaseApiKeyInput.trim() || !this.coinbaseApiSecretInput.trim() || this.coinbaseSaving) return;
    this.coinbaseSaving = true;
    const token = localStorage.getItem('ws_token');
    fetch(`${(window as any).__WS_API__ || 'http://localhost:5000'}/api/users/me/coinbase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ apiKey: this.coinbaseApiKeyInput.trim(), apiSecret: this.coinbaseApiSecretInput.trim() })
    }).then(async r => {
      this.coinbaseSaving = false;
      if (r.ok) {
        this.userCoinbaseLinked = true;
        this.coinbaseModalOpen = false;
        this.toast('Coinbase ligada!', 'success');
        this.loadCoinbaseBalance();
      } else {
        const d = await r.json();
        this.toast(d.message || 'Erro ao guardar chaves', 'error');
      }
    }).catch(() => { this.coinbaseSaving = false; this.toast('Erro de rede', 'error'); });
  }

  loadCoinbaseBalance() {
    if (!this.userCoinbaseLinked) return;
    this.coinbaseError = '';
    this.userService.getCoinbaseBalance().subscribe({
      next: (r: any) => {
        this.coinbaseBalances = r.balances || [];
        this.drawAllocPie();
      },
      error: (e: any) => {
        this.coinbaseError = e.error?.message || 'Erro ao carregar Coinbase';
      }
    });
  }

  openWiseModal() { this.wiseModalOpen = true; this.wiseTokenInput = ''; }
  closeWiseModal() { this.wiseModalOpen = false; }

  saveWiseToken() {
    if (!this.wiseTokenInput.trim() || this.wiseSaving) return;
    this.wiseSaving = true;
    const token = localStorage.getItem('ws_token');
    fetch(`${(window as any).__WS_API__ || 'http://localhost:5000'}/api/users/me/wise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ apiToken: this.wiseTokenInput.trim() })
    }).then(async r => {
      this.wiseSaving = false;
      if (r.ok) {
        this.userWiseLinked = true;
        this.wiseModalOpen = false;
        this.toast('Wise ligado!', 'success');
        this.loadWiseBalance();
      } else {
        const d = await r.json();
        this.toast(d.message || 'Erro ao guardar token', 'error');
      }
    }).catch(() => { this.wiseSaving = false; this.toast('Erro de rede', 'error'); });
  }

  loadWiseBalance() {
    if (!this.userWiseLinked) return;
    this.userService.getWiseBalance().subscribe({
      next: (r: any) => { this.wiseBalances = r.balances || []; },
      error: () => {}
    });
  }

  // ── Financial Goals (DB-backed) ──────────────────────────────────────
  goals: any[] = []; // { _id, label, target, deadline, notified }
  goalModalOpen: boolean = false;
  goalLabel: string = '';
  goalTarget: number = 0;
  goalDeadline: string = '';
  goalEditId: string | null = null; // MongoDB _id
  goalSaving: boolean = false;
  readonly goalColors = ['#c97b6a','#4a9e6b','#c9a84c','#8b7cc4','#e8813a','#009cde','#7b6f5e'];

  loadGoals() {
    this.userService.getGoals().subscribe({
      next: (goals) => {
        this.goals = goals.map((g, i) => ({ ...g, color: this.goalColors[i % this.goalColors.length], current: this.calculatedNetWorth }));
        this.checkGoalNotifications();
      },
      error: () => {} // silently fail — user may not be logged in yet
    });
  }

  openGoalModal(goal?: any) {
    if (goal) {
      this.goalEditId = goal._id;
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
    if (!this.goalLabel.trim() || this.goalTarget <= 0 || this.goalSaving) return;
    this.goalSaving = true;
    if (this.goalEditId !== null) {
      this.userService.updateGoal(this.goalEditId, { label: this.goalLabel, target: this.goalTarget, deadline: this.goalDeadline, notified: false })
        .subscribe({
          next: (goals) => { this.goals = goals.map((g, i) => ({ ...g, color: this.goalColors[i % this.goalColors.length], current: this.calculatedNetWorth })); this.goalModalOpen = false; this.goalSaving = false; this.checkGoalNotifications(); },
          error: () => { this.goalSaving = false; }
        });
    } else {
      if (this.goals.length >= 5) { this.goalSaving = false; return; }
      this.userService.addGoal({ label: this.goalLabel, target: this.goalTarget, deadline: this.goalDeadline })
        .subscribe({
          next: (goals) => { this.goals = goals.map((g, i) => ({ ...g, color: this.goalColors[i % this.goalColors.length], current: this.calculatedNetWorth })); this.goalModalOpen = false; this.goalSaving = false; this.checkGoalNotifications(); },
          error: () => { this.goalSaving = false; }
        });
    }
  }

  deleteGoal(id: string) {
    this.userService.deleteGoal(id).subscribe({
      next: (goals) => { this.goals = goals.map((g, i) => ({ ...g, color: this.goalColors[i % this.goalColors.length], current: this.calculatedNetWorth })); },
      error: () => {}
    });
  }

  checkGoalNotifications() {
    const now = Date.now();
    const netWorth = this.calculatedNetWorth;
    for (const g of this.goals) {
      if (g.notified) continue;
      const reached = netWorth >= g.target;
      const overdue = g.deadline && new Date(g.deadline).getTime() < now && !reached;
      if (reached || overdue) {
        this.userService.updateGoal(g._id, { notified: true }).subscribe();
        g.notified = true;
      }
    }
  }

  goalProgress(g: { target: number }): number {
    if (!g.target || g.target === 0) return 0;
    return Math.min(100, Math.round((this.calculatedNetWorth / g.target) * 100));
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
    return this.binanceCryptoHoldings.reduce((s: number, h: any) => s + (h.valueEur || 0), 0);
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
    if (this.t212Portfolio?.positions) {
      for (const p of this.t212Portfolio.positions) {
        items.push({
          source: 'T212', sourceColor: '#4A9EFF',
          ticker: p.ticker || '',
          name: p.fullName || p.ticker || '',
          value: p.currentValue || 0,
          change: p.ppl || null,
          changePct: (p.currentValue && p.averagePrice && p.quantity)
            ? (p.ppl / (p.averagePrice * p.quantity) * 100) : null,
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

  binanceError: string = '';
  loadExternalBalances() {
    if (this.userBinanceLinked) {
      this.binanceError = '';
      this.userService.getBinanceBalance().subscribe({
        next: (r: any) => {
          this.binanceBalances = r.balances || [];
          this.drawAllocPie();
          const binanceVal = this.binanceTotalEur;
          if (binanceVal > 0) this.titles['cripto'] = ['Cripto', `Binance €${binanceVal.toFixed(0)} · Trading 212 Cripto`];
          // Load prices for whatever assets user actually has
          const userAssets = this.binanceBalances.map((b: any) => this.getCoinId(b.asset)).filter(Boolean);
          const allCoins = [...new Set([...this.cryptoCoins, ...userAssets])].join(',');
          this.http.get<any>(`${environment.apiUrl}/external/crypto/prices?ids=${allCoins}`).subscribe({
            next: (data: any) => {
              for (const id of allCoins.split(',')) {
                if (data[id]) this.cryptoPrices[id] = { price: data[id].eur, change24h: data[id].eur_24h_change ?? 0 };
              }
            }
          });
        },
        error: (err: any) => {
          this.binanceError = err.error?.message || 'Erro ao carregar saldo Binance';
        }
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
    this.loadCoinbaseBalance();
    this.loadWiseBalance();
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
  invTab: 'portfolio' | 'pesquisar' | 'watchlist' | 'grafico' = 'portfolio';
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
    { key: 'materiais', label: 'Materiais', icon: '🏗️' },
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
      this.invAlertEdit.priceAtCreation = this.invSelectedStock?.regularMarketPrice ?? 0;
    } else {
      const existing = this.alertsForSymbol(this.invAlertSymbol);
      if (existing.length >= 3) { this.toast('Máximo de 3 alertas por ação.', 'info'); return; }
      this.invAlerts.push({
        id: Date.now(),
        symbol: this.invAlertSymbol,
        name: this.invSelectedStock?.shortName || this.invAlertSymbol,
        currency: this.invSelectedStock?.currency || '€',
        targetPrice: this.invNewAlert.targetPrice,
        direction: this.invNewAlert.direction,
        triggered: false,
        priceAtCreation: this.invSelectedStock?.regularMarketPrice ?? 0,
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
      if (!hit) return;
      // Don't fire immediately if price was already past threshold when alert was created
      const creationPrice: number = a.priceAtCreation ?? (a.direction === 'above' ? 0 : Infinity);
      const wasAlreadyMet = a.direction === 'above'
        ? creationPrice >= a.targetPrice
        : creationPrice <= a.targetPrice;
      if (wasAlreadyMet) return;
      a.triggered = true;
      changed = true;
      const msg = `${a.symbol} ${a.direction === 'above' ? '≥' : '≤'} ${a.currency} ${a.targetPrice.toFixed(2)} — atual: ${a.currency} ${price.toFixed(2)}`;
      this.notifications.unshift({
        id: Date.now(), type: 'price', icon: '📈',
        title: `Alerta: ${a.symbol}`,
        message: msg,
        time: new Date(), read: false
      });
      this.unreadNotifs++;
      // OS / browser notification (Windows & mobile)
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`WealthSphere — Alerta: ${a.symbol}`, {
            body: msg,
            icon: '/favicon.ico'
          });
        } catch {}
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
        this.invChartData = Array.isArray(res) ? res : (res.quotes || res.data || []);
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

  // Steam Watchlist (CS2 tab) - real, persisted
  wlSteamSearch: string = '';
  wlSteamSuggestions: any[] = [];
  wlSteamSearching: boolean = false;
  wlSteamList: {name: string; targetPrice: number|null; currentPrice: number|null; icon: string|null; appid: number}[] = [];
  wlSteamLoading: boolean = false;
  private wlSteamSearchTimer: any = null;

  private loadWlSteamList() {
    try { this.wlSteamList = JSON.parse(localStorage.getItem('ws_steam_wl') || '[]'); } catch { this.wlSteamList = []; }
  }
  private saveWlSteamList() { localStorage.setItem('ws_steam_wl', JSON.stringify(this.wlSteamList)); }

  searchWlSteam() {
    clearTimeout(this.wlSteamSearchTimer);
    if (!this.wlSteamSearch || this.wlSteamSearch.length < 2) { this.wlSteamSuggestions = []; return; }
    this.wlSteamSearching = true;
    this.wlSteamSearchTimer = setTimeout(() => {
      this.http.get<{results: any[]}>(`${environment.apiUrl}/external/steam/search?q=${encodeURIComponent(this.wlSteamSearch)}&appid=730&count=8`)
        .subscribe({ next: r => { this.wlSteamSuggestions = r.results || []; this.wlSteamSearching = false; }, error: () => { this.wlSteamSearching = false; } });
    }, 400);
  }

  addWlSteamItem(item: any) {
    if (this.wlSteamList.some(x => x.name === item.name)) { this.wlSteamSuggestions = []; this.wlSteamSearch = ''; return; }
    this.wlSteamList.unshift({ name: item.name, targetPrice: null, currentPrice: item.price ?? null, icon: item.icon ?? null, appid: 730 });
    this.saveWlSteamList();
    this.wlSteamSuggestions = [];
    this.wlSteamSearch = '';
  }

  removeWlSteamItem(name: string) {
    this.wlSteamList = this.wlSteamList.filter(x => x.name !== name);
    this.saveWlSteamList();
  }

  setWlSteamTarget(item: any, val: string) {
    item.targetPrice = val ? +val : null;
    this.saveWlSteamList();
  }

  loadWlSteamPrices() {
    if (!this.wlSteamList.length) return;
    this.wlSteamLoading = true;
    let pending = this.wlSteamList.length;
    for (const item of this.wlSteamList) {
      this.http.get<{price: number|null}>(`${environment.apiUrl}/external/steam/price?name=${encodeURIComponent(item.name)}`)
        .subscribe({ next: r => { item.currentPrice = r.price; if (--pending === 0) { this.wlSteamLoading = false; this.saveWlSteamList(); } }, error: () => { if (--pending === 0) this.wlSteamLoading = false; } });
    }
  }

  // ROI autocomplete
  roiSuggestions: any[] = [];
  roiSearching: boolean = false;
  private roiSearchTimer: any = null;

  searchRoiItems() {
    clearTimeout(this.roiSearchTimer);
    const q = this.roiCalc.itemName;
    if (!q || q.length < 2) { this.roiSuggestions = []; return; }
    this.roiSearching = true;
    this.roiSearchTimer = setTimeout(() => {
      this.http.get<{results: any[]}>(`${environment.apiUrl}/external/steam/search?q=${encodeURIComponent(q)}&appid=730&count=6`)
        .subscribe({ next: r => { this.roiSuggestions = r.results || []; this.roiSearching = false; }, error: () => { this.roiSearching = false; } });
    }, 400);
  }

  selectRoiItem(item: any) {
    this.roiCalc.itemName = item.name;
    this.roiSuggestions = [];
    if (item.price) { this.roiCalc.sellPrice = item.price; this.calcROI(); }
  }

  // Top 10 - dynamic
  top10Loading: boolean = false;

  selectMarketGame(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedMarketGameId = val;
    const names: Record<string, string> = {
      cs2: 'Counter-Strike 2', rust: 'Rust', tf2: 'Team Fortress 2',
      kf2: 'Killing Floor 2', warframe: 'Warframe', h1z1: 'Z1 Battle Royale'
    };
    this.selectedMarketGameName = names[val] || val;
    this.loadTop10ForGame(val);
  }

  loadTop10ForGame(game: string) {
    this.top10Loading = true;
    this.http.get<{items: any[]}>(`${environment.apiUrl}/external/steam/top10?game=${game}`)
      .subscribe({ next: r => { this.top10Items = (r.items || []).map(i => ({ name: i.name, price: '€' + (i.price||0).toFixed(2), icon: i.icon })); this.top10Loading = false; }, error: () => { this.top10Loading = false; } });
  }

  // Crypto page
  cryptoTab: 'portfolio' | 'mercado' = 'portfolio';
  tvChartCoin = 'BTCUSDT';
  tvChartInterval = 'D';
  marketOrderBook: { bids: [string,string][], asks: [string,string][] } = { bids: [], asks: [] };
  marketTrades: any[] = [];
  marketTicker: any = null;
  marketRefreshTimer: any = null;
  cryptoSearchInput: string = '';
  stockTVSymbol: string = 'AAPL';
  stockTVInterval: string = 'D';
  cryptoPrices: Record<string, {price: number; change24h: number}> = {};
  cryptoPricesLoading: boolean = false;
  cryptoCoins = ['bitcoin','ethereum','solana','ripple','cardano','polkadot','chainlink','avalanche-2','matic-network','dogecoin','tether','usd-coin','binancecoin','shiba-inu','litecoin','the-open-network','stellar','monero','cosmos','uniswap'];
  cryptoSymbols: Record<string,string> = { bitcoin:'BTC', ethereum:'ETH', solana:'SOL', ripple:'XRP', cardano:'ADA', polkadot:'DOT', chainlink:'LINK', 'avalanche-2':'AVAX', 'matic-network':'MATIC', dogecoin:'DOGE' };

  get tvChartCoinId(): string {
    const map: Record<string, string> = {
      BTCUSDT:'bitcoin', ETHUSDT:'ethereum', SOLUSDT:'solana', BNBUSDT:'binancecoin',
      XRPUSDT:'ripple', ADAUSDT:'cardano', DOGEUSDT:'dogecoin', LTCUSDT:'litecoin',
      TONUSDT:'the-open-network', XLMUSDT:'stellar', ATOMUSDT:'cosmos'
    };
    return map[this.tvChartCoin] || '';
  }

  get tvChartPrice(): number { return this.cryptoPrices[this.tvChartCoinId]?.price ?? 0; }
  get tvChartChange(): number { return this.cryptoPrices[this.tvChartCoinId]?.change24h ?? 0; }

  loadTVChart(symbol: string = this.tvChartCoin, interval: string = this.tvChartInterval) {
    this.tvChartCoin = symbol;
    this.tvChartInterval = interval;
    setTimeout(() => {
      const container = document.getElementById('tv-chart-container');
      if (!container) return;
      container.innerHTML = '';
      if ((window as any).TradingView) {
        this.initTVWidget(symbol, interval);
      } else {
        const s = document.createElement('script');
        s.src = 'https://s3.tradingview.com/tv.js';
        s.async = true;
        s.onload = () => this.initTVWidget(symbol, interval);
        document.head.appendChild(s);
      }
    }, 80);
  }

  private initTVWidget(symbol: string, interval: string) {
    new (window as any).TradingView.widget({
      autosize: true,
      symbol: `BINANCE:${symbol}`,
      interval: interval,
      timezone: 'Europe/Lisbon',
      theme: this.isDark ? 'dark' : 'light',
      style: '1',
      locale: 'pt_BR',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: 'tv-chart-container',
      height: 520,
      studies: ['RSI@tv-studyapi', 'MASimple@tv-studyapi']
    });
  }

  loadMarketData_full() {
    const sym = this.tvChartCoin;
    this.http.get<any>(`${environment.apiUrl}/external/crypto/orderbook?symbol=${sym}`).subscribe({
      next: d => {
        this.marketOrderBook = {
          asks: (d.asks || []).slice(0, 12).reverse(),
          bids: (d.bids || []).slice(0, 12)
        };
      }
    });
    this.http.get<any[]>(`${environment.apiUrl}/external/crypto/trades?symbol=${sym}`).subscribe({
      next: d => { this.marketTrades = (d || []).slice(0, 25).reverse(); }
    });
    this.http.get<any>(`${environment.apiUrl}/external/crypto/ticker24h?symbol=${sym}`).subscribe({
      next: d => { this.marketTicker = d; }
    });
  }

  startMarketRefresh() {
    this.stopMarketRefresh();
    this.loadMarketData_full();
    this.marketRefreshTimer = setInterval(() => this.loadMarketData_full(), 4000);
  }

  stopMarketRefresh() {
    if (this.marketRefreshTimer) { clearInterval(this.marketRefreshTimer); this.marketRefreshTimer = null; }
  }

  switchMarketCoin(sym: string) {
    this.tvChartCoin = sym;
    this.cryptoSearchInput = '';
    this.loadMarketData_full();
    this.loadTVChart(sym, this.tvChartInterval);
  }

  searchAndSwitchCoin() {
    const raw = this.cryptoSearchInput.trim().toUpperCase();
    if (!raw) return;
    // If user typed just "BTC", append "USDT"
    const sym = raw.includes('USD') || raw.includes('BTC') || raw.includes('ETH') || raw.endsWith('T') && raw.length > 4
      ? raw : raw + 'USDT';
    this.switchMarketCoin(sym);
  }

  loadStockTVChart(symbol: string = this.stockTVSymbol, interval: string = this.stockTVInterval) {
    this.stockTVSymbol = symbol;
    this.stockTVInterval = interval;
    const container = document.getElementById('stock-tv-chart-container');
    if (!container) { setTimeout(() => this.loadStockTVChart(symbol, interval), 300); return; }
    container.innerHTML = '';
    const loadWidget = () => {
      new (window as any).TradingView.widget({
        container_id: 'stock-tv-chart-container',
        symbol: symbol,
        interval: interval,
        timezone: 'Europe/Lisbon',
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        style: '1',
        locale: 'pt',
        toolbar_bg: 'transparent',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        height: 520,
        width: '100%',
        studies: ['Volume@tv-basicstudies'],
      });
    };
    if ((window as any).TradingView) { loadWidget(); return; }
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = loadWidget;
    document.head.appendChild(script);
  }

  loadCryptoPrices() {
    this.cryptoPricesLoading = true;
    const ids = this.cryptoCoins.join(',');
    this.http.get<any>(`${environment.apiUrl}/external/crypto/prices?ids=${ids}`)
      .subscribe({
        next: data => {
          for (const id of this.cryptoCoins) {
            if (data[id]) this.cryptoPrices[id] = { price: data[id].eur, change24h: data[id].eur_24h_change };
          }
          this.cryptoPricesLoading = false;
        },
        error: () => { this.cryptoPricesLoading = false; }
      });
  }

  getCoinId(asset: string): string {
    const coinIdMap: Record<string, string> = { BTC:'bitcoin', ETH:'ethereum', SOL:'solana', XRP:'ripple', ADA:'cardano', DOT:'polkadot', LINK:'chainlink', AVAX:'avalanche-2', MATIC:'matic-network', DOGE:'dogecoin', BNB:'binancecoin', USDT:'tether', USDC:'usd-coin', BUSD:'binance-usd', SHIB:'shiba-inu', LTC:'litecoin', TON:'the-open-network', XLM:'stellar', XMR:'monero', ATOM:'cosmos', UNI:'uniswap', TRX:'tron', NEAR:'near', FTM:'fantom', ARB:'arbitrum', OP:'optimism' };
    return coinIdMap[asset] || '';
  }

  get binanceCryptoHoldings(): any[] {
    if (!this.binanceBalances?.length) return [];
    const coinIdMap: Record<string, string> = { BTC:'bitcoin', ETH:'ethereum', SOL:'solana', XRP:'ripple', ADA:'cardano', DOT:'polkadot', LINK:'chainlink', AVAX:'avalanche-2', MATIC:'matic-network', DOGE:'dogecoin', BNB:'binancecoin', USDT:'tether', USDC:'usd-coin', BUSD:'binance-usd', SHIB:'shiba-inu', LTC:'litecoin', TON:'the-open-network', XLM:'stellar', XMR:'monero', ATOM:'cosmos', UNI:'uniswap', TRX:'tron', NEAR:'near', FTM:'fantom', ARB:'arbitrum', OP:'optimism' };
    return this.binanceBalances.filter((b: any) => (b.total || 0) > 0.0001).map((b: any) => {
      const id = coinIdMap[b.asset] || this.getCoinId(b.asset);
      const priceData = id ? this.cryptoPrices[id] : null;
      return { ...b, coinId: id, priceEur: priceData?.price ?? b.priceEur ?? 0, change24h: priceData?.change24h ?? 0, valueEur: (b.total || 0) * (priceData?.price ?? b.priceEur ?? 0) };
    }).sort((a: any, b: any) => b.valueEur - a.valueEur);
  }

  get t212CryptoHoldings(): any[] {
    if (!this.t212Portfolio?.positions) return [];
    return this.t212Portfolio.positions.filter((p: any) => p.ticker?.includes('_EQ') === false && (p.type === 'CRYPTOCURRENCY' || (p.ticker && /BTC|ETH|SOL|DOGE|ADA|DOT/.test(p.ticker)))).map((p: any) => ({
      name: p.fullName || p.ticker,
      ticker: p.ticker,
      value: p.currentValue || 0,
      result: p.ppl || 0,
      ppl: p.ppl || 0
    }));
  }

  get cryptoTotalEur(): number {
    const binance = this.binanceCryptoHoldings.reduce((s: number, h: any) => s + (h.valueEur || 0), 0);
    const t212c = this.t212CryptoHoldings.reduce((s: number, h: any) => s + (h.value || 0), 0);
    return binance + t212c;
  }

  // Watchlist items (now loaded from localStorage, not hardcoded)
  watchlistItems: any[] = [];

  private loadWatchlistItems() {
    try { this.watchlistItems = JSON.parse(localStorage.getItem('ws_steam_wl') || '[]'); } catch { this.watchlistItems = []; }
  }

  top10Items: {name: string; price: string; icon?: string|null}[] = [
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
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

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
  skinHistoryLoading = false;
  skinHistoryPolyline = '';
  skinHistoryFill = '';
  skinHistoryMin = 0;
  skinHistoryMax = 0;
  skinHistoryFirst = 0;
  skinHistoryLast = 0;
  skinHistoryPeriod: string = '90d'; // 7d | 30d | 90d | 1y | max
  skinHistoryRaw: { time: number; price: number }[] = [];
  skinPriceOverview: { lowest?: number|null; median?: number|null; volume?: string|null; currency?: string; steamUrl?: string; skinport?: { min?: number|null; max?: number|null; suggested?: number|null; quantity?: number|null } } | null = null;
  readonly skinHistoryPeriods = [
    { key: '7d', label: '7D', days: 7 },
    { key: '30d', label: '1M', days: 30 },
    { key: '90d', label: '3M', days: 90 },
    { key: '1y', label: '1A', days: 365 },
    { key: 'max', label: 'Max', days: 9999 },
  ];

  // CS2 Mercado Search
  cs2MarketQuery: string = '';
  cs2MarketResults: any[] = [];
  cs2MarketSearching: boolean = false;
  private cs2MarketTimer: any = null;

  // Mobile sidebar
  mobileSidebarOpen: boolean = false;
  toggleMobileSidebar() { this.mobileSidebarOpen = !this.mobileSidebarOpen; }
  closeMobileSidebar() { this.mobileSidebarOpen = false; }

  // Popup overlay drag-selection fix
  private _overlayMouseDownOnBg = false;
  onOverlayMouseDown(event: MouseEvent) {
    this._overlayMouseDownOnBg = (event.target as HTMLElement) === (event.currentTarget as HTMLElement);
  }
  onOverlayClick(event: MouseEvent, closeFn: () => void) {
    if (this._overlayMouseDownOnBg && (event.target as HTMLElement) === (event.currentTarget as HTMLElement)) {
      closeFn();
    }
    this._overlayMouseDownOnBg = false;
  }

  // i18n
  readonly TRANSLATIONS: Record<string, Record<string, string>> = {
    pt: {
      // Nav
      dashboard: 'Dashboard', income: 'Income Tracker', taxas: 'Taxas & Mercados',
      cs2: 'CS2 & Steam', comunidade: 'Comunidade', rendas: 'Rendas & Imóveis',
      simulador: 'Simulador', investimentos: 'Investimentos', cripto: 'Cripto',
      perfil: 'Perfil', definicoes: 'Definições',
      // Financial overview
      networth: 'Património Líquido', monthly_income: 'Receita Mensal',
      monthly_expenses: 'Despesas Mensais', savings_rate: 'Taxa de Poupança',
      // Stat cards
      stat_networth: 'Net Worth', stat_networth_sub: 'Património total (excl. Voláteis)',
      stat_rents: 'Rendas / mês', stat_rents_sub: 'Rendimento real acumulado',
      stat_etf: 'Portfólio ETF', stat_etf_empty: 'Sem ativos registados',
      stat_steam: 'Inventário Steam', stat_savings: 'Poupança Mensal',
      stat_savings_sub: 'Rendimento Líquido Livre',
      // Common UI
      save: 'Guardar', cancel: 'Cancelar', search: 'Pesquisar', loading: 'A carregar...',
      language: 'Idioma', nationality: 'Nacionalidade',
      update_data: '+ Atualizar Dados', clear_alerts: 'Limpar alertas',
      no_items: 'Sem itens', active: 'Ativo', empty: 'Vazio',
      // Sections
      financial_goals: 'Metas Financeiras', add_goal: 'Adicionar Meta',
      my_alerts: 'Os meus alertas', new_alert: 'Novo Alerta',
      recent_transactions: 'Transações Recentes', add_transaction: 'Adicionar',
      // Income tracker
      income_tab_overview: 'Resumo', income_tab_manual: 'Manual', income_tab_history: 'Histórico',
      // Definições
      settings_language: 'Idioma & Localização', settings_save: 'Guardar alterações',
      settings_export: 'Exportar dados', settings_danger: 'Zona de Perigo',
    },
    en: {
      // Nav
      dashboard: 'Dashboard', income: 'Income Tracker', taxas: 'Rates & Markets',
      cs2: 'CS2 & Steam', comunidade: 'Community', rendas: 'Rentals & Real Estate',
      simulador: 'Simulator', investimentos: 'Investments', cripto: 'Crypto',
      perfil: 'Profile', definicoes: 'Settings',
      // Financial overview
      networth: 'Net Worth', monthly_income: 'Monthly Income',
      monthly_expenses: 'Monthly Expenses', savings_rate: 'Savings Rate',
      // Stat cards
      stat_networth: 'Net Worth', stat_networth_sub: 'Total assets (excl. Volatile)',
      stat_rents: 'Rents / month', stat_rents_sub: 'Accumulated real income',
      stat_etf: 'ETF Portfolio', stat_etf_empty: 'No assets registered',
      stat_steam: 'Steam Inventory', stat_savings: 'Monthly Savings',
      stat_savings_sub: 'Free Net Income',
      // Common UI
      save: 'Save', cancel: 'Cancel', search: 'Search', loading: 'Loading...',
      language: 'Language', nationality: 'Nationality',
      update_data: '+ Update Data', clear_alerts: 'Clear alerts',
      no_items: 'No items', active: 'Active', empty: 'Empty',
      // Sections
      financial_goals: 'Financial Goals', add_goal: 'Add Goal',
      my_alerts: 'My alerts', new_alert: 'New Alert',
      recent_transactions: 'Recent Transactions', add_transaction: 'Add',
      // Income tracker
      income_tab_overview: 'Overview', income_tab_manual: 'Manual', income_tab_history: 'History',
      // Definições
      settings_language: 'Language & Locale', settings_save: 'Save changes',
      settings_export: 'Export data', settings_danger: 'Danger Zone',
    },
    fr: {
      // Nav
      dashboard: 'Tableau de bord', income: 'Suivi des revenus', taxas: 'Taux & Marchés',
      cs2: 'CS2 & Steam', comunidade: 'Communauté', rendas: 'Locations & Immobilier',
      simulador: 'Simulateur', investimentos: 'Investissements', cripto: 'Crypto',
      perfil: 'Profil', definicoes: 'Paramètres',
      // Financial overview
      networth: 'Patrimoine Net', monthly_income: 'Revenus Mensuels',
      monthly_expenses: 'Dépenses Mensuelles', savings_rate: 'Taux d\'épargne',
      // Stat cards
      stat_networth: 'Patrimoine Net', stat_networth_sub: 'Actifs totaux (excl. Volatils)',
      stat_rents: 'Loyers / mois', stat_rents_sub: 'Revenu réel accumulé',
      stat_etf: 'Portefeuille ETF', stat_etf_empty: 'Aucun actif enregistré',
      stat_steam: 'Inventaire Steam', stat_savings: 'Épargne Mensuelle',
      stat_savings_sub: 'Revenu Net Libre',
      // Common UI
      save: 'Enregistrer', cancel: 'Annuler', search: 'Rechercher', loading: 'Chargement...',
      language: 'Langue', nationality: 'Nationalité',
      update_data: '+ Mettre à jour', clear_alerts: 'Effacer alertes',
      no_items: 'Aucun élément', active: 'Actif', empty: 'Vide',
      // Sections
      financial_goals: 'Objectifs Financiers', add_goal: 'Ajouter Objectif',
      my_alerts: 'Mes alertes', new_alert: 'Nouvelle Alerte',
      recent_transactions: 'Transactions Récentes', add_transaction: 'Ajouter',
      // Income tracker
      income_tab_overview: 'Résumé', income_tab_manual: 'Manuel', income_tab_history: 'Historique',
      // Definições
      settings_language: 'Langue & Localisation', settings_save: 'Enregistrer',
      settings_export: 'Exporter données', settings_danger: 'Zone de Danger',
    },
    de: {
      // Nav
      dashboard: 'Dashboard', income: 'Einkommenstracker', taxas: 'Zinsen & Märkte',
      cs2: 'CS2 & Steam', comunidade: 'Community', rendas: 'Mieten & Immobilien',
      simulador: 'Simulator', investimentos: 'Investitionen', cripto: 'Krypto',
      perfil: 'Profil', definicoes: 'Einstellungen',
      // Financial overview
      networth: 'Nettovermögen', monthly_income: 'Monatliche Einnahmen',
      monthly_expenses: 'Monatliche Ausgaben', savings_rate: 'Sparquote',
      // Stat cards
      stat_networth: 'Nettovermögen', stat_networth_sub: 'Gesamtvermögen (excl. Volatil)',
      stat_rents: 'Mieten / Monat', stat_rents_sub: 'Aufgelaufenes Realeinkommen',
      stat_etf: 'ETF-Portfolio', stat_etf_empty: 'Keine Vermögenswerte',
      stat_steam: 'Steam-Inventar', stat_savings: 'Monatliche Ersparnisse',
      stat_savings_sub: 'Freies Nettoeinkommen',
      // Common UI
      save: 'Speichern', cancel: 'Abbrechen', search: 'Suchen', loading: 'Laden...',
      language: 'Sprache', nationality: 'Nationalität',
      update_data: '+ Daten aktualisieren', clear_alerts: 'Benachrichtigungen löschen',
      no_items: 'Keine Einträge', active: 'Aktiv', empty: 'Leer',
      // Sections
      financial_goals: 'Finanzziele', add_goal: 'Ziel hinzufügen',
      my_alerts: 'Meine Alarme', new_alert: 'Neuer Alarm',
      recent_transactions: 'Letzte Transaktionen', add_transaction: 'Hinzufügen',
      // Income tracker
      income_tab_overview: 'Übersicht', income_tab_manual: 'Manuell', income_tab_history: 'Verlauf',
      // Definições
      settings_language: 'Sprache & Standort', settings_save: 'Änderungen speichern',
      settings_export: 'Daten exportieren', settings_danger: 'Gefahrenzone',
    },
  };

  t(key: string): string {
    const lang = this.appLanguage in this.TRANSLATIONS ? this.appLanguage : 'pt';
    return this.TRANSLATIONS[lang][key] ?? this.TRANSLATIONS['pt'][key] ?? key;
  }

  setLanguage(lang: string) {
    this.appLanguage = lang;
    localStorage.setItem('ws_language', lang);
    // Update nav titles
    this.titles['dashboard'][0] = this.t('dashboard');
    this.titles['income'][0] = this.t('income');
    this.titles['taxas'][0] = this.t('taxas');
    this.titles['cs2'][0] = this.t('cs2');
    this.titles['comunidade'][0] = this.t('comunidade');
    this.titles['rendas'][0] = this.t('rendas');
    this.titles['simulador'][0] = this.t('simulador');
    this.titles['investimentos'][0] = this.t('investimentos');
    this.titles['cripto'][0] = this.t('cripto');
    this.titles['perfil'][0] = this.t('perfil');
    this.titles['definicoes'][0] = this.t('definicoes');
  }

  autoDetectLanguage() {
    const saved = localStorage.getItem('ws_language');
    if (saved) {
      this.appLanguage = saved;
    } else {
      const nav = navigator.language?.slice(0, 2).toLowerCase() || 'pt';
      const supported = ['pt', 'en', 'fr', 'de'];
      this.appLanguage = supported.includes(nav) ? nav : 'pt';
      localStorage.setItem('ws_language', this.appLanguage);
    }
    // Apply language to nav titles immediately on load
    this.setLanguage(this.appLanguage);
  }

  // Currency exchange simulator
  simCambio = {
    amount: 100,
    from: 'EUR',
    to: 'USD',
    result: null as number | null,
    rate: null as number | null,
    loading: false,
    error: '',
    updatedAt: null as Date | null,
  };

  readonly CURRENCY_LIST = [
    { code: 'EUR', label: '🇪🇺 Euro' },
    { code: 'USD', label: '🇺🇸 Dólar EUA' },
    { code: 'GBP', label: '🇬🇧 Libra Esterlina' },
    { code: 'CHF', label: '🇨🇭 Franco Suíço' },
    { code: 'JPY', label: '🇯🇵 Iene Japonês' },
    { code: 'CAD', label: '🇨🇦 Dólar Canadense' },
    { code: 'AUD', label: '🇦🇺 Dólar Australiano' },
    { code: 'CNY', label: '🇨🇳 Yuan Chinês' },
    { code: 'BRL', label: '🇧🇷 Real Brasileiro' },
    { code: 'SEK', label: '🇸🇪 Coroa Sueca' },
    { code: 'NOK', label: '🇳🇴 Coroa Norueguesa' },
    { code: 'DKK', label: '🇩🇰 Coroa Dinamarquesa' },
    { code: 'NZD', label: '🇳🇿 Dólar NZ' },
    { code: 'SGD', label: '🇸🇬 Dólar Singapura' },
    { code: 'HKD', label: '🇭🇰 Dólar Hong Kong' },
    { code: 'MXN', label: '🇲🇽 Peso Mexicano' },
    { code: 'INR', label: '🇮🇳 Rupia Indiana' },
    { code: 'ZAR', label: '🇿🇦 Rand Sul-Africano' },
    { code: 'TRY', label: '🇹🇷 Lira Turca' },
    { code: 'KRW', label: '🇰🇷 Won Coreano' },
    { code: 'PLN', label: '🇵🇱 Zloty Polaco' },
    { code: 'CZK', label: '🇨🇿 Coroa Checa' },
    { code: 'HUF', label: '🇭🇺 Forint Húngaro' },
    { code: 'RON', label: '🇷🇴 Leu Romeno' },
    { code: 'AED', label: '🇦🇪 Dirham UAE' },
    { code: 'SAR', label: '🇸🇦 Riyal Saudita' },
    { code: 'THB', label: '🇹🇭 Baht Tailandês' },
    { code: 'IDR', label: '🇮🇩 Rupia Indonésia' },
    { code: 'PHP', label: '🇵🇭 Peso Filipino' },
    { code: 'MYR', label: '🇲🇾 Ringgit Malaio' },
  ];

  swapCurrencies() {
    const tmp = this.simCambio.from;
    this.simCambio.from = this.simCambio.to;
    this.simCambio.to = tmp;
    this.simCambio.result = null;
    this.simCambio.rate = null;
    this.convertCurrency();
  }

  convertCurrency() {
    const { amount, from, to } = this.simCambio;
    if (!amount || !from || !to || from === to) {
      this.simCambio.result = from === to ? amount : null;
      this.simCambio.rate = from === to ? 1 : null;
      return;
    }
    this.simCambio.loading = true;
    this.simCambio.error = '';
    this.http.get<any>(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`)
      .subscribe({
        next: (r) => {
          this.simCambio.result = r.rates?.[to] ?? null;
          this.simCambio.rate = r.rates?.[to] != null ? r.rates[to] / amount : null;
          this.simCambio.loading = false;
          this.simCambio.updatedAt = new Date();
        },
        error: () => {
          this.simCambio.error = 'Erro ao obter taxa de câmbio. Tenta novamente.';
          this.simCambio.loading = false;
        }
      });
  }

  // DEGIRO CSV import
  degrioImportOpen: boolean = false;
  degrioImportResult: any = null;
  degrioImportError: string = '';

  onDegrioFileUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseDegrioCSV(text);
    };
    reader.readAsText(file);
  }

  parseDegrioCSV(csv: string) {
    try {
      const lines = csv.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.match(/(".*?"|[^,]+)/g) || [];
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/"/g, '').trim(); });
        return obj;
      }).filter(r => r['Product'] || r['Produto']);

      const totalValue = rows.reduce((sum, r) => {
        const v = parseFloat(r['Value in EUR'] || r['Valor em EUR'] || r['Value'] || '0') || 0;
        return sum + Math.abs(v);
      }, 0);

      this.degrioImportResult = {
        rows: rows.slice(0, 50),
        totalValue,
        count: rows.length,
        headers
      };
      this.degrioImportError = '';
      this.toast(`DEGIRO: ${rows.length} transações importadas (€${totalValue.toFixed(2)})`, 'success');
    } catch (e) {
      this.degrioImportError = 'Erro ao processar CSV. Certifica-te que é um ficheiro de exportação DEGIRO.';
      this.degrioImportResult = null;
    }
  }

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
    showAmort: false,
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

  simDeposito = {
    capital: 10000,
    taxa: 3.5,
    anos: 1,
    periodicidade: 1, // 1=anual, 2=semestral, 4=trimestral, 12=mensal
    results: null as any
  };

  simMaisValias = {
    valorAquisicao: 150000,
    valorVenda: 250000,
    anosPosse: 5,
    obras: 10000,
    comissao: 3,
    outrosCustos: 2000,
    habitacaoPropria: true,
    residente: true,
    results: null as any
  };

  simCarro = {
    amount: 20000,
    years: 5,
    tan: 6.9,
    results: { prestacao: 0, totalJuros: 0, totalPago: 0 }
  };

  simPessoal = {
    amount: 10000,
    years: 4,
    tan: 9.0,
    results: { prestacao: 0, totalJuros: 0, totalPago: 0 }
  };

  bankRatesCarro = [
    { bank: 'CA Auto Bank',      tan: 5.90, taeg: 6.10, maxYears: 7,  flag: '🟢', note: 'Especialistas em crédito automóvel' },
    { bank: 'Santander Portugal', tan: 6.50, taeg: 6.80, maxYears: 8, flag: '🟢', note: 'Carro novo e usado' },
    { bank: 'CGD',                tan: 6.90, taeg: 7.20, maxYears: 7, flag: '🟢', note: 'Crédito Auto Caixa' },
    { bank: 'BPI',                tan: 7.00, taeg: 7.30, maxYears: 7, flag: '🟢', note: 'BPI Auto' },
    { bank: 'Millennium BCP',     tan: 7.20, taeg: 7.50, maxYears: 7, flag: '🟡', note: 'Financiamento até 100%' },
    { bank: 'Novo Banco',         tan: 7.50, taeg: 7.80, maxYears: 7, flag: '🟡', note: 'Sem entrada obrigatória' },
    { bank: 'Banco CTT',          tan: 8.50, taeg: 8.90, maxYears: 5, flag: '🟡', note: '100% digital' },
    { bank: 'Cofidis',            tan: 9.90, taeg: 10.40, maxYears: 7, flag: '🔴', note: 'Até 6 anos' },
  ];

  bankRatesPessoal = [
    { bank: 'CGD',            tan: 8.50,  taeg: 8.90,  maxYears: 7, flag: '🟢', note: 'Crédito Pessoal Caixa' },
    { bank: 'BPI',            tan: 9.00,  taeg: 9.40,  maxYears: 7, flag: '🟢', note: 'BPI Pessoal' },
    { bank: 'Santander',      tan: 8.90,  taeg: 9.30,  maxYears: 7, flag: '🟢', note: 'Inclui domiciliação' },
    { bank: 'Millennium BCP', tan: 9.20,  taeg: 9.60,  maxYears: 7, flag: '🟡', note: 'Financiamento flexível' },
    { bank: 'Novo Banco',     tan: 9.50,  taeg: 9.90,  maxYears: 7, flag: '🟡', note: 'Montante até €75k' },
    { bank: 'Banco CTT',      tan: 10.50, taeg: 10.90, maxYears: 5, flag: '🟡', note: '100% digital, rápido' },
    { bank: 'Cofidis',        tan: 12.90, taeg: 13.70, maxYears: 7, flag: '🔴', note: 'Sem justificação de destino' },
    { bank: 'Cetelem',        tan: 13.50, taeg: 14.30, maxYears: 7, flag: '🔴', note: 'Sem comprovativo de rendimento' },
  ];

  applyCarroRate(tan: number) { this.simCarro.tan = tan; this.calcCarro(); }
  applyPessoalRate(tan: number) { this.simPessoal.tan = tan; this.calcPessoal(); }

  calcCarro() {
    const { amount, years, tan } = this.simCarro;
    const r = tan / 100 / 12;
    const n = Math.max(1, years * 12);
    const prestacao = r === 0 ? amount / n : amount * r / (1 - Math.pow(1 + r, -n));
    this.simCarro.results = {
      prestacao: Math.round(prestacao * 100) / 100,
      totalPago: Math.round(prestacao * n * 100) / 100,
      totalJuros: Math.round((prestacao * n - amount) * 100) / 100
    };
  }

  calcPessoal() {
    const { amount, years, tan } = this.simPessoal;
    const r = tan / 100 / 12;
    const n = Math.max(1, years * 12);
    const prestacao = r === 0 ? amount / n : amount * r / (1 - Math.pow(1 + r, -n));
    this.simPessoal.results = {
      prestacao: Math.round(prestacao * 100) / 100,
      totalPago: Math.round(prestacao * n * 100) / 100,
      totalJuros: Math.round((prestacao * n - amount) * 100) / 100
    };
  }

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
    { id: 'ch',      title: 'Crédito Habitação', desc: 'Simula prestações, Euribor e amortizações.', icon: '🏠', tags: ['banco', 'casa', 'prestação'] },
    { id: 'carro',   title: 'Crédito Automóvel', desc: 'Simula financiamento de carro com taxas reais.', icon: '🚗', tags: ['carro', 'auto', 'prestação', 'banco'] },
    { id: 'pessoal', title: 'Crédito Pessoal',   desc: 'Crédito pessoal: compara TAN e TAEG de cada banco.', icon: '👤', tags: ['pessoal', 'empréstimo', 'banco'] },
    { id: 'juros',   title: 'Juros Compostos',   desc: 'O poder do tempo no teu investimento.', icon: '📈', tags: ['etf', 'poupança', 'futuro'] },
    { id: 'fire',    title: 'Calculadora FIRE',   desc: 'Quando podes deixar de trabalhar?', icon: '🔥', tags: ['independência', 'reforma'] },
    { id: 'mercado', title: 'Taxas & Bancos',     desc: 'Comparativo completo de taxas por produto.', icon: '🌍', tags: ['mercado', 'bce', 'fed', 'taxas'] },
    { id: 'rendas',    title: 'Rendas & Imóveis',       desc: 'Cálculo de yield e rentabilidade.', icon: '🔑', tags: ['aluguer', 'imobiliário'] },
    { id: 'inflacao',  title: 'Poder de Compra',        desc: 'O impacto da inflação no teu dinheiro.', icon: '💸', tags: ['custo de vida', 'preços'] },
    { id: 'deposito',  title: 'Depósito a Prazo',       desc: 'Simula retorno de depósito com IRS incluído.', icon: '🏦', tags: ['poupança', 'banco', 'depósito', 'juros'] },
    { id: 'maisvalias',title: 'Mais-valias Imobiliárias', desc: 'Calcula o IRS a pagar na venda de imóveis.', icon: '📑', tags: ['imobiliário', 'irs', 'venda', 'capital'] }
  ];

  get filteredSims() {
    return this.simCategories.filter(c => 
      c.title.toLowerCase().includes(this.simSearch.toLowerCase()) ||
      c.tags.some(t => t.toLowerCase().includes(this.simSearch.toLowerCase()))
    );
  }

  @ViewChild('trendChart', { static: false }) trendChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('compareChart', { static: false }) compareChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('jurosChart', { static: false }) jurosChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fireChart', { static: false }) fireChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rendasChart', { static: false }) rendasChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('inflacaoChart', { static: false }) inflacaoChartCanvas!: ElementRef<HTMLCanvasElement>;

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

  /** Limpa ticker T212 interno (ex: "VHVGl" → "VHVG", "NDAQ_US" → "NDAQ") */
  cleanTicker(ticker: string): string {
    return (ticker || '')
      .replace(/_[A-Z]+$/g, '')  // Remove sufixos em maiúsculas: _EQ, _US, etc.
      .replace(/[a-z]+$/, '')    // Remove códigos de bolsa em minúsculas: l (London), d (Xetra), s, etc.
      .replace(/\d+$/, '');      // Remove dígitos finais residuais
  }

  /** Cor do avatar por posição (cycling palette) */
  getPositionColor(index: number): string {
    const palette = [
      '#4a7c59','#7b6ea8','#c97b4b','#4a789e','#9e4a4a',
      '#6b9e4a','#9e7b4a','#4a9e8b','#7b4a9e','#9e4a7b',
      '#5a6ea8','#a86e5a','#6ea85a','#a85a6e','#5aa8a8'
    ];
    return palette[index % palette.length];
  }

  /** % de retorno para uma posição */
  getPosGainPct(pos: any): number {
    const cost = (pos.averagePrice || 0) * (pos.quantity || 0);
    if (!cost) return 0;
    return ((pos.ppl ?? 0) / cost) * 100;
  }

  getMemberSince(): string {
    if (!this.userCreatedAt) return '—';
    const month = this.userCreatedAt.toLocaleDateString('pt-PT', { month: 'short' });
    const year = this.userCreatedAt.getFullYear();
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  }

  getTodaySubtitle(): string {
    const now = new Date();
    const day = now.toLocaleDateString('pt-PT', { weekday: 'long' });
    const dayNum = now.getDate();
    const month = now.toLocaleDateString('pt-PT', { month: 'long' });
    return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${dayNum} de ${month.charAt(0).toUpperCase() + month.slice(1)}`;
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

  ngOnDestroy() { this.stopMarketRefresh(); this.stopInvAutoRefresh(); }

  private _resizeTimer: any;
  @HostListener('window:resize')
  onWindowResize() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      if (this.currentPage === 'investimentos') {
        this.drawT212Chart();
        this.drawT212Treemap();
      }
    }, 200);
  }

  ngOnInit() {
    this.loadTheme();
    this.autoDetectLanguage();
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
          this.titles['perfil'] = ['Perfil', this.userName];
        }
      } catch (e) {
        console.error('Error parsing user', e);
      }
    }
    // Restore last visited page on reload
    const savedPage = localStorage.getItem('ws_last_page');
    const validPages = ['dashboard','income','simulador','cs2','investimentos','cripto','comunidade','metas','rendas','taxas','definicoes','perfil'];
    if (savedPage && validPages.includes(savedPage)) {
      this.currentPage = savedPage;
      // Trigger any page-specific data loads
      setTimeout(() => this.showPage(savedPage), 0);
    }
    this.loadProfile();
    this.loadTransactions();
    this.calcSimAll();
    this.userService.warmUpBackend(); // wake up Render.com free-tier backend before news fetch
    this.loadDashNews();
    this.loadForumPosts();
    this.loadGoals();
    this.loadWlSteamList();
    this.loadTop10ForGame('cs2');

    // Request browser notification permission for price alerts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Check CS2 price alerts on startup (after 5s) then every 15 min
    setTimeout(() => this.checkAlertPrices(), 5000);
    setInterval(() => this.checkAlertPrices(), 15 * 60 * 1000);
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

        this.toast('Conta Steam desassociada com sucesso.', 'success');
        this.steamLoading = false;
        // Atualizar perfil para refletir mudanças na UI
        this.loadProfile();
      },
      error: (err) => {
        console.error('Unlink error:', err);
        this.steamLoading = false;
        this.toast('Erro ao desassociar conta: ' + (err.error?.message || 'Erro desconhecido'), 'error');
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
        this.userNationality = user.nationality || 'pt';
        this.titles['perfil'] = ['Perfil', `${this.userName} · ${this.userNationalityDisplay}`];
        // Auto-select salary calculator country from user's registered nationality
        const natToCountry: Record<string, string> = {
          pt: 'PT', br: 'BR', en: 'GB', gb: 'GB', us: 'US', fr: 'FR', de: 'DE',
          es: 'ES', it: 'IT', nl: 'NL', ch: 'CH', ie: 'IE', be: 'BE', at: 'AT',
          se: 'SE', pl: 'PL', ro: 'RO', ca: 'CA', au: 'AU', jp: 'JP'
        };
        const mapped = natToCountry[this.userNationality];
        if (mapped) this.salaryCalc.country = mapped;

        this.t212ApiKey = '';
        this.binanceKey = '';
        this.binanceSecret = '';
        this.krakenKey = '';
        this.krakenSecret = '';
        this.userT212Linked = !!user.hasTrading212ApiKey;
        this.userBinanceLinked = !!user.hasBinanceApiKey;
        this.userKrakenLinked = !!user.hasKrakenApiKey;
        this.userCoinbaseLinked = !!user.hasCoinbaseApiKey;
        this.userWiseLinked = !!user.hasWiseApiToken;
        if (user.createdAt) this.userCreatedAt = new Date(user.createdAt);
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
        // Dynamic subtitles
        const incomeMonth = new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
        this.titles['income'] = ['Income Tracker', incomeMonth.charAt(0).toUpperCase() + incomeMonth.slice(1)];
        this.titles['rendas'] = ['Rendas & Imóveis', `${this.realEstate.length} imóv${this.realEstate.length === 1 ? 'el' : 'eis'} · €${this.totalRents.toLocaleString('pt-PT')}/mês`];
        if (user.steamId && user.steamName) {
          this.titles['cs2'] = ['CS2 & Steam', `Steam: ${user.steamName}`];
        }
      }
    });
  }

  saveCustomSettings() {
    this.savingSettings = true;
    this.userService.updateCustomSettings(this.customSettings).subscribe({
      next: (res) => {
        this.savingSettings = false;
        this.toast('Definições atualizadas com sucesso!', 'success');
        this.loadProfile();
      },
      error: (err) => {
        this.savingSettings = false;
        this.toast('Erro ao atualizar definições: ' + (err.error?.message || err.message), 'error');
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
          // Normalize positions: flatten nested T212 API structure into flat fields
          if (this.t212Portfolio?.positions) {
            this.t212Portfolio.positions = this.t212Portfolio.positions.map((p: any) => ({
              ...p,
              ticker: p.instrument?.ticker || p.ticker || '',
              fullName: p.instrument?.name || p.fullName || p.ticker || '',
              currency: p.instrument?.currency || p.walletImpact?.currency || 'EUR',
              currentValue: p.walletImpact?.currentValue ?? (p.currentPrice * p.quantity) ?? 0,
              ppl: p.walletImpact?.unrealizedProfitLoss ?? p.ppl ?? 0,
              averagePrice: p.averagePricePaid ?? p.averagePrice ?? 0,
            }));
          }
          this.generateChartData();
          if (this.currentPage === 'dashboard') {
            this.drawPatrimonioChart(this.data[this.currentChartPeriod]);
          }
          this.drawAllocPie();
          // Load portfolio evolution history after getting fresh data
          this.loadT212History();
          // Draw treemap once DOM is ready
          setTimeout(() => this.drawT212Treemap(), 80);
          // Dynamic subtitle
          const t212Total = res.data?.total;
          if (t212Total != null) this.titles['investimentos'] = ['Investimentos', `T212 €${(+t212Total).toFixed(0)} · Pesquisar ações`];
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
        this.toast('Nome atualizado com sucesso!', 'success');
      },
      error: (err) => {
        console.error('Profile update error:', err);
        this.savingName = false;
        this.toast('Erro ao atualizar nome: ' + (err.error?.message || err.message), 'error');
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
        this.toast('API Trading 212 ligada com sucesso!', 'success');
      },
      error: (err) => {
        this.savingApis = false;
        this.toast('Erro ao ligar API: ' + (err.error?.message || err.message), 'error');
      }
    });
  }

  openBinanceModal() { this.binanceKey = ''; this.binanceSecret = ''; this.binanceModalOpen = true; }
  closeBinanceModal() { this.binanceModalOpen = false; }
  saveBinance() {
    if (!this.binanceKey.trim() || !this.binanceSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ binanceApiKey: this.binanceKey, binanceApiSecret: this.binanceSecret }).subscribe({
      next: () => { this.savingApis = false; this.closeBinanceModal(); this.loadProfile(); this.toast('Binance ligada com sucesso!', 'success'); },
      error: (err: any) => { this.savingApis = false; this.toast('Erro: ' + (err.error?.message || err.message), 'error'); }
    });
  }

  openKrakenModal() { this.krakenKey = ''; this.krakenSecret = ''; this.krakenModalOpen = true; }
  closeKrakenModal() { this.krakenModalOpen = false; }
  saveKraken() {
    if (!this.krakenKey.trim() || !this.krakenSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ krakenApiKey: this.krakenKey, krakenApiSecret: this.krakenSecret }).subscribe({
      next: () => { this.savingApis = false; this.closeKrakenModal(); this.loadProfile(); this.toast('Kraken ligado com sucesso!', 'success'); },
      error: (err: any) => { this.savingApis = false; this.toast('Erro: ' + (err.error?.message || err.message), 'error'); }
    });
  }

  openPaypalModal() { this.paypalClientId = ''; this.paypalClientSecret = ''; this.paypalModalOpen = true; }
  closePaypalModal() { this.paypalModalOpen = false; }
  savePaypal() {
    if (!this.paypalClientId.trim() || !this.paypalClientSecret.trim()) return;
    this.savingApis = true;
    this.userService.updateExternalApis({ paypalClientId: this.paypalClientId, paypalClientSecret: this.paypalClientSecret }).subscribe({
      next: () => { this.savingApis = false; this.closePaypalModal(); this.loadProfile(); this.toast('PayPal ligado com sucesso!', 'success'); },
      error: (err: any) => { this.savingApis = false; this.toast('Erro: ' + (err.error?.message || err.message), 'error'); }
    });
  }

  // ── Income Tracker — Salary Calculator ──
  salaryCalc = {
    country: 'PT',
    grossMonthly: 1500,
    dependents: 0,
    married: false,
    results: null as any
  };

  readonly salaryCountries = [
    { code: 'PT', label: '🇵🇹 Portugal' },
    { code: 'ES', label: '🇪🇸 Espanha' },
    { code: 'DE', label: '🇩🇪 Alemanha' },
    { code: 'FR', label: '🇫🇷 França' },
    { code: 'GB', label: '🇬🇧 Reino Unido' },
    { code: 'US', label: '🇺🇸 EUA' },
    { code: 'NL', label: '🇳🇱 Países Baixos' },
    { code: 'IE', label: '🇮🇪 Irlanda' },
    { code: 'CH', label: '🇨🇭 Suíça' },
    { code: 'BE', label: '🇧🇪 Bélgica' },
    { code: 'AT', label: '🇦🇹 Áustria' },
    { code: 'SE', label: '🇸🇪 Suécia' },
    { code: 'PL', label: '🇵🇱 Polónia' },
    { code: 'RO', label: '🇷🇴 Roménia' },
    { code: 'CA', label: '🇨🇦 Canadá' },
    { code: 'AU', label: '🇦🇺 Austrália' },
    { code: 'JP', label: '🇯🇵 Japão' },
    { code: 'BR', label: '🇧🇷 Brasil' },
  ];

  calcSalarioLiquido() {
    const { country, grossMonthly, dependents, married } = this.salaryCalc;
    const grossAnnual = grossMonthly * 14; // PT usa 14 salários; ajustado abaixo por país
    let ss = 0, irsTax = 0, otherDeductions = 0, netMonthly = 0, netAnnual = 0;
    let breakdown: any[] = [];
    let notes = '';

    if (country === 'PT') {
      // Segurança Social: 11% (empregado)
      ss = grossMonthly * 0.11;
      // IRS — Escalões 2025 (rendimento coletável anual = bruto anual − SS anual)
      const rendColAnual = grossMonthly * 14 - ss * 14;
      const brackets = [
        { limit: 7703,  rate: 0.1325 },
        { limit: 11623, rate: 0.18 },
        { limit: 16472, rate: 0.23 },
        { limit: 21321, rate: 0.26 },
        { limit: 27146, rate: 0.3275 },
        { limit: 39791, rate: 0.37 },
        { limit: 51997, rate: 0.435 },
        { limit: 81199, rate: 0.45 },
        { limit: Infinity, rate: 0.48 }
      ];
      let irsAnual = 0, prev = 0;
      for (const b of brackets) {
        if (rendColAnual <= prev) break;
        const slice = Math.min(rendColAnual, b.limit) - prev;
        irsAnual += slice * b.rate;
        prev = b.limit;
      }
      // Dedução específica €4.462 (empregado por conta de outrem)
      irsAnual = Math.max(0, irsAnual - 4462 * (brackets.find(b => rendColAnual <= b.limit)?.rate || 0.1325));
      // Abatimento por dependente: €600 por dependente
      irsAnual = Math.max(0, irsAnual - dependents * 600);
      irsTax = irsAnual / 14;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 14;
      notes = 'Base: 14 salários (subsídio de férias + natal). SS empregador: 23,75% (não incluído). IRS estimado — use simulador AT para valor exato.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Segurança Social (11%)', value: -ss, type: 'deduction' },
        { label: 'IRS estimado (escalões 2025)', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×14)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'ES') {
      // Seg. Social: 6.35% geral
      ss = grossMonthly * 0.0635;
      const rendAnual = grossMonthly * 12 - ss * 12;
      const brackets = [
        { limit: 12450, rate: 0.19 },
        { limit: 20200, rate: 0.24 },
        { limit: 35200, rate: 0.30 },
        { limit: 60000, rate: 0.37 },
        { limit: 300000, rate: 0.45 },
        { limit: Infinity, rate: 0.47 }
      ];
      let irpfAnual = 0, prev = 0;
      for (const b of brackets) {
        if (rendAnual <= prev) break;
        irpfAnual += (Math.min(rendAnual, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = irpfAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Base: 12 salários. SS empregador: 29,9%. IRPF estimado — varia por Comunidade Autónoma.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Seg. Social (6,35%)', value: -ss, type: 'deduction' },
        { label: 'IRPF estimado', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'DE') {
      // Contribuições sociais totais empregado: ~20.175% (pensões 9.3%, saúde 7.3%, desemprego 1.3%, cuidados 1.525% + cota suplementar)
      ss = grossMonthly * 0.2018;
      const rendAnual = grossMonthly * 12 - ss * 12;
      // Lohnsteuer simplificado — escalões 2025
      let lohnsteuerAnual = 0;
      if (rendAnual > 11784) {
        const taxable = rendAnual - 11784;
        if (taxable <= 61971) lohnsteuerAnual = taxable * 0.14 + (taxable / 61971) * (0.42 - 0.14) * taxable / 2;
        else if (taxable <= 277825) lohnsteuerAnual = taxable * 0.42 - 9972.98;
        else lohnsteuerAnual = taxable * 0.45 - 18307.73;
      }
      // Solidaritätszuschlag: 5.5% do imposto (acima do limiar — actualmente poucos pagam)
      irsTax = lohnsteuerAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'SS total empregado ~20,18%. Solidaritätszuschlag não incluído (maioria isenta desde 2021). Kirchensteuer (imposto eclesiástico) não incluído.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Contribuições Sociais (~20,18%)', value: -ss, type: 'deduction' },
        { label: 'Lohnsteuer estimado', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'FR') {
      // Cotisações sociais empregado: ~22% (saúde, pensão, desemprego)
      ss = grossMonthly * 0.22;
      const rendAnual = grossMonthly * 12 - ss * 12;
      // IR francês 2025 (foyer fiscal de 1 pessoa)
      const brackets = [
        { limit: 11294, rate: 0 },
        { limit: 28797, rate: 0.11 },
        { limit: 82341, rate: 0.30 },
        { limit: 177106, rate: 0.41 },
        { limit: Infinity, rate: 0.45 }
      ];
      let irAnual = 0, prev = 0;
      for (const b of brackets) {
        if (rendAnual <= prev) break;
        irAnual += (Math.min(rendAnual, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = irAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Cotizações empregador: ~42%. IR = imposto sobre o rendimento (declaração anual). CSG/CRDS já incluídas nas cotizações sociais.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Cotisations Sociales (~22%)', value: -ss, type: 'deduction' },
        { label: 'Impôt sur le Revenu (IR)', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'GB') {
      // GBP → EUR aproximado (1 GBP ≈ 1.17 EUR) — inputs em EUR
      // National Insurance: 8% sobre salário anual acima de £12.570 (≈€14.710)
      const annualEur = grossMonthly * 12;
      const niThreshold = 14710;
      const niRate = 0.08;
      ss = Math.max(0, (annualEur - niThreshold) * niRate) / 12;
      // Income Tax: Personal allowance £12.570 (≈€14.710), depois 20%, 40%, 45%
      let itAnual = 0;
      const personalAllowance = 14710;
      const basicRate = { limit: 14710 + 52270, rate: 0.20 }; // £50.270 em EUR
      const higherRate = { limit: 14710 + 52270 + 112730, rate: 0.40 }; // £125k
      if (annualEur > personalAllowance) {
        const taxable = annualEur - personalAllowance;
        if (annualEur <= basicRate.limit) itAnual = taxable * 0.20;
        else if (annualEur <= higherRate.limit) itAnual = 52270 * 0.20 + (taxable - 52270) * 0.40;
        else itAnual = 52270 * 0.20 + 112730 * 0.40 + (taxable - 52270 - 112730) * 0.45;
      }
      irsTax = itAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Valores em EUR (conversão aproximada 1 GBP ≈ 1.17 EUR). NI empregador: 13.8%. Student Loan não incluído.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'National Insurance (8%)', value: -ss, type: 'deduction' },
        { label: 'Income Tax', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'US') {
      // FICA: 7.65% (Social Security 6.2% + Medicare 1.45%)
      ss = grossMonthly * 0.0765;
      const annualEur = grossMonthly * 12;
      // Federal Income Tax 2025 (single filer, standard deduction $14.600 ≈ €13.600)
      const stdDeduction = 13600;
      const taxable = Math.max(0, annualEur - stdDeduction);
      const brackets = [
        { limit: 11600, rate: 0.10 },
        { limit: 47150, rate: 0.12 },
        { limit: 100525, rate: 0.22 },
        { limit: 191950, rate: 0.24 },
        { limit: 243725, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 }
      ];
      let federalTax = 0, prev = 0;
      for (const b of brackets) {
        if (taxable <= prev) break;
        federalTax += (Math.min(taxable, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = federalTax / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Federal tax apenas. State/local tax varia por estado (0%–13%). Contribuições para 401k não consideradas.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'FICA (7,65%)', value: -ss, type: 'deduction' },
        { label: 'Federal Income Tax', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês (federal)', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total (federal)', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'NL') {
      // Países Baixos: contribuições sociais empregado ~27.65% (AOW, ANW, WLZ) + prémio saúde
      ss = grossMonthly * 0.1765; // contribuição empregado ZVW (~6.57%) + AOW (pensão)
      const annualEur = grossMonthly * 12;
      // Box 1 (rendimento trabalho) — escalões 2025
      let itAnual = 0;
      if (annualEur > 38098) itAnual = (annualEur - 38098) * 0.495 + 38098 * 0.3697;
      else itAnual = annualEur * 0.3697;
      // Arbeidskorting (crédito fiscal trabalho) — simplificado €5.052 máx
      const arbeidskorting = Math.min(5052, annualEur * 0.28);
      itAnual = Math.max(0, itAnual - arbeidskorting);
      irsTax = itAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'ZVW (saúde): €154/mês pago separadamente pelo empregador. Heffingskorting (crédito geral) não aplicado. Cálculo estimado.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Contrib. Sociais (ZVW + pensão)', value: -ss, type: 'deduction' },
        { label: 'Inkomstenbelasting (Box 1)', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'IE') {
      // Irlanda: PRSI 4% + USC + Income Tax
      ss = grossMonthly * 0.04; // PRSI
      const annualEur = grossMonthly * 12;
      // USC (Universal Social Charge) 2025
      let uscAnual = 0;
      if (annualEur > 13000) {
        const exc = annualEur - 13000;
        if (annualEur <= 25760) uscAnual = (annualEur - 13000) * 0.02 + 13000 * 0.005;
        else if (annualEur <= 70044) uscAnual = 12760 * 0.02 + (annualEur - 25760) * 0.04 + 13000 * 0.005;
        else uscAnual = 12760 * 0.02 + 44284 * 0.04 + (annualEur - 70044) * 0.08 + 13000 * 0.005;
      }
      // Income Tax: personal credit €1.875, employee credit €1.875
      let itAnual = 0;
      const personalCredits = 3750;
      if (annualEur <= 42000) itAnual = annualEur * 0.20 - personalCredits;
      else itAnual = 42000 * 0.20 + (annualEur - 42000) * 0.40 - personalCredits;
      itAnual = Math.max(0, itAnual);
      irsTax = (uscAnual + itAnual) / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'PRSI: 4%. USC + Income Tax estimados para solteiro sem dependentes. Pension relief não incluído.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'PRSI (4%)', value: -ss, type: 'deduction' },
        { label: 'USC + Income Tax', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'CH') {
      // Suíça: contribuições AHV/IV/EO ~5.3% + ALV 1.1% + outros ~1%
      ss = grossMonthly * 0.074; // total empregado ~7.4%
      const annualEur = grossMonthly * 12;
      // Imposto federal direto (simplificado — cantão ZH como referência)
      let itAnual = 0;
      if (annualEur > 14500) {
        if (annualEur <= 31600) itAnual = (annualEur - 14500) * 0.077;
        else if (annualEur <= 41400) itAnual = 1318 + (annualEur - 31600) * 0.088;
        else if (annualEur <= 55200) itAnual = 2182 + (annualEur - 41400) * 0.11;
        else itAnual = 3700 + (annualEur - 55200) * 0.133;
      }
      irsTax = itAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Cantão ZH como referência. Taxa cantonal varia significativamente (ZG ~15%, GE ~35%). Pillar 2/3 não incluídos.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'AHV/IV/ALV (~7,4%)', value: -ss, type: 'deduction' },
        { label: 'Imposto Federal (ref. ZH)', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'BR') {
      // Brasil: INSS (progressivo) + IRPF (escalões 2025)
      const inss = [
        { limit: 1518, rate: 0.075 },
        { limit: 2793.88, rate: 0.09 },
        { limit: 4190.83, rate: 0.12 },
        { limit: 8157.41, rate: 0.14 }
      ];
      let inssTotal = 0, prev = 0;
      for (const b of inss) {
        if (grossMonthly <= prev) break;
        inssTotal += (Math.min(grossMonthly, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      ss = Math.min(inssTotal, 908.85); // tecto máximo INSS
      // IRPF 2025 (mensal, base = bruto − INSS − dedução por dependente R$189,59)
      const baseIrpf = grossMonthly - ss - dependents * 189.59;
      const irpfBrackets = [
        { limit: 2259.20, rate: 0 },
        { limit: 2826.65, rate: 0.075 },
        { limit: 3751.05, rate: 0.15 },
        { limit: 4664.68, rate: 0.225 },
        { limit: Infinity, rate: 0.275 }
      ];
      let irpf = 0; prev = 0;
      const deducoes = [0, 169.44, 381.44, 662.77, 896];
      let bracket = 0;
      for (let i = 0; i < irpfBrackets.length; i++) {
        if (baseIrpf <= irpfBrackets[i].limit) { bracket = i; break; }
      }
      irpf = Math.max(0, baseIrpf * irpfBrackets[bracket].rate - deducoes[bracket]);
      irsTax = irpf;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Valores em BRL. INSS progressivo 2025. FGTS (8%) pago pelo empregador, não descontado do salário. 13º salário não incluído.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'INSS (progressivo)', value: -ss, type: 'deduction' },
        { label: 'IRPF', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'BE') {
      // Bélgica: cotizações sociais empregado 13.07%
      ss = grossMonthly * 0.1307;
      const rendAnual = grossMonthly * 12 - ss * 12;
      // IPP belga 2025 — isenção €9.270, depois escalões
      const exempt = 9270;
      const brackets = [
        { limit: exempt, rate: 0 },
        { limit: 15200, rate: 0.25 },
        { limit: 26830, rate: 0.40 },
        { limit: 46440, rate: 0.45 },
        { limit: Infinity, rate: 0.50 }
      ];
      let ippAnual = 0, prev = 0;
      for (const b of brackets) {
        if (rendAnual <= prev) break;
        ippAnual += (Math.min(rendAnual, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = ippAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'SS empregado: 13,07%. SS empregador: 27%. IPP (imposto pessoas físicas) estimado para solteiro sem dependentes. Communal tax (~7%) não incluída.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Cotisações Sociais (13,07%)', value: -ss, type: 'deduction' },
        { label: 'IPP estimado', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'AT') {
      // Áustria: 14 salários. SS empregado ~18.07% (pensão 10.25%, saúde 3.87%, desemprego 3%, outros 0.95%)
      ss = grossMonthly * 0.1807;
      const annualEur = grossMonthly * 14 - ss * 14;
      // ESt 2025 (Einkommensteuer)
      const brackets = [
        { limit: 11693, rate: 0 },
        { limit: 19134, rate: 0.20 },
        { limit: 32075, rate: 0.30 },
        { limit: 62080, rate: 0.41 },
        { limit: 93120, rate: 0.48 },
        { limit: 1000000, rate: 0.50 },
        { limit: Infinity, rate: 0.55 }
      ];
      let estAnual = 0, prev = 0;
      for (const b of brackets) {
        if (annualEur <= prev) break;
        estAnual += (Math.min(annualEur, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = estAnual / 14;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 14;
      notes = 'Base: 14 salários (Urlaubs- e Weihnachtsgeld). SS empregador: ~21.48%. Einkommensteuer 2025 estimado — use bmf.gv.at para valor exato.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Contribuições Sociais (~18,07%)', value: -ss, type: 'deduction' },
        { label: 'Einkommensteuer estimado', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×14)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'SE') {
      // Suécia: pensão pública (allmän pension) 7% pago pelo empregado
      ss = grossMonthly * 0.07;
      const annualEur = grossMonthly * 12;
      // Imposto municipal médio ~32% + imposto estatal 20% acima de ~€53.000
      const stateThreshold = 53000;
      let itAnual = 0;
      // Grundavdrag (dedução básica) ~€2.500 simplificado
      const taxable = Math.max(0, annualEur - 2500);
      if (annualEur <= stateThreshold) {
        itAnual = taxable * 0.32;
      } else {
        itAnual = (stateThreshold - 2500) * 0.32 + (annualEur - stateThreshold) * (0.32 + 0.20);
      }
      irsTax = itAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Imposto municipal médio ~32% (varia por município). Imposto estatal 20% acima de ~€53.000. Jobbskatteavdrag (crédito trabalho) não aplicado — cálculo conservador.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Pensão Pública (7%)', value: -ss, type: 'deduction' },
        { label: 'Kommunalskatt + Statlig skatt', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'PL') {
      // Polónia: ZUS empregado ~22.71% (emerytalne 9.76%, rentowe 1.5%, chorobowe 2.45%, zdrowotne 9%)
      ss = grossMonthly * 0.1871; // 9.76+1.5+2.45+5% saúde dedutível
      const baseZdrowotna = grossMonthly - ss * (0.1371 / 0.1871); // base saúde separada
      const annualEur = grossMonthly * 12;
      // PIT 2025: isenção €6.588 (30.000 PLN ≈ €7.050), escalões
      const exempt = 7050;
      const upperBracket = 28235; // 120.000 PLN ≈ €28.235
      let pitAnual = 0;
      const taxable = Math.max(0, annualEur - exempt);
      if (annualEur <= upperBracket) {
        pitAnual = taxable * 0.12;
      } else {
        pitAnual = (upperBracket - exempt) * 0.12 + (annualEur - upperBracket) * 0.32;
      }
      irsTax = pitAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'ZUS empregado ~18,71% (sem zdrowotna total). PIT 2025 estimado. 1 EUR ≈ 4,25 PLN (ref.). SS empregador: ~20,48%.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'ZUS (contribuições sociais)', value: -ss, type: 'deduction' },
        { label: 'PIT estimado', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'RO') {
      // Roménia: CAS 25% + CASS 10% (empregado paga tudo)
      const cas = grossMonthly * 0.25;
      const cass = grossMonthly * 0.10;
      ss = cas + cass;
      // CASS dedutível (10% sobre bruto − CAS)
      const baseImpozit = Math.max(0, grossMonthly - cas - cass);
      // Imposto de rendimento: 10% flat
      irsTax = baseImpozit * 0.10;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'CAS: 25%, CASS: 10% (ambos pagos pelo empregado). Imposto de rendimento: 10% flat. Deducție personală não aplicada (simplificado).';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'CAS (25%)', value: -cas, type: 'deduction' },
        { label: 'CASS (10%)', value: -cass, type: 'deduction' },
        { label: 'Imposto de Rendimento (10%)', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'CA') {
      // Canadá: CPP 5.95% + EI 1.66%
      const annualEur = grossMonthly * 12;
      const cppMax = 3867; // máximo anual CPP (≈$4.055 CAD convertido)
      const eiMax = 1049;  // máximo anual EI (≈$1.049 CAD)
      const cppEmployee = Math.min(annualEur * 0.0595, cppMax);
      const eiEmployee = Math.min(annualEur * 0.0166, eiMax);
      ss = (cppEmployee + eiEmployee) / 12;
      // Federal income tax 2025 (basic personal amount ~€12.100)
      const bpa = 12100;
      const taxable = Math.max(0, annualEur - bpa);
      const brackets = [
        { limit: 57375, rate: 0.15 },
        { limit: 114750, rate: 0.205 },
        { limit: 158519, rate: 0.26 },
        { limit: 220000, rate: 0.29 },
        { limit: Infinity, rate: 0.33 }
      ];
      let fedTaxAnual = 0, prev = 0;
      for (const b of brackets) {
        if (taxable <= prev) break;
        fedTaxAnual += (Math.min(taxable, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      irsTax = fedTaxAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Federal tax apenas. Provincial tax adicional (5%–21% conforme província). CPP e EI limitados ao máximo anual. 1 CAD ≈ 0,68 EUR (ref.).';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'CPP + EI', value: -ss, type: 'deduction' },
        { label: 'Federal Income Tax', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês (federal)', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total (federal)', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'AU') {
      // Austrália: Medicare Levy 2% (sem SS adicional do empregado; Super pago pelo empregador)
      ss = grossMonthly * 0.02;
      const annualEur = grossMonthly * 12;
      // Income tax 2024-25 (limiar isenção AUD 18.200 ≈ €11.200)
      const exempt = 11200;
      const taxable = Math.max(0, annualEur - exempt);
      let itAnual = 0;
      if (annualEur <= 11200) itAnual = 0;
      else if (annualEur <= 27700) itAnual = (annualEur - 11200) * 0.19;
      else if (annualEur <= 83000) itAnual = 3135 + (annualEur - 27700) * 0.325;
      else if (annualEur <= 116900) itAnual = 21087 + (annualEur - 83000) * 0.37;
      else itAnual = 33641 + (annualEur - 116900) * 0.45;
      irsTax = itAnual / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Medicare Levy: 2%. Superannuation (11,5%) pago pelo empregador, não descontado. LITO (Low Income Tax Offset) não aplicado. 1 AUD ≈ 0,61 EUR (ref.).';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Medicare Levy (2%)', value: -ss, type: 'deduction' },
        { label: 'Income Tax', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    } else if (country === 'JP') {
      // Japão: seguro saúde ~5% + pensão ~9.15% empregado
      ss = grossMonthly * 0.1415;
      const annualEur = grossMonthly * 12 - ss * 12;
      // Imposto nacional 2025 (yuuyo shotoku kojo €350/mês ≈ €4.200/ano descontado)
      const employeeDeduct = Math.min(annualEur * 0.20 + 4200, 19500);
      const taxBase = Math.max(0, annualEur - employeeDeduct);
      // Escalões nacionais (JPY convertido; 1 EUR ≈ 155 JPY ref.)
      const brackets = [
        { limit: 12581, rate: 0.05 },
        { limit: 21290, rate: 0.10 },
        { limit: 44839, rate: 0.20 },
        { limit: 58065, rate: 0.23 },
        { limit: 116129, rate: 0.33 },
        { limit: 232258, rate: 0.40 },
        { limit: Infinity, rate: 0.45 }
      ];
      let nationalTax = 0, prev = 0;
      for (const b of brackets) {
        if (taxBase <= prev) break;
        nationalTax += (Math.min(taxBase, b.limit) - prev) * b.rate;
        prev = b.limit;
      }
      // Imposto local (juminzei): ~10% sobre base tributável
      const localTax = taxBase * 0.10;
      irsTax = (nationalTax + localTax) / 12;
      netMonthly = grossMonthly - ss - irsTax;
      netAnnual = netMonthly * 12;
      notes = 'Seguro saúde ~5% + pensão ~9,15%. Imposto local (juminzei) ~10% incluído. 1 EUR ≈ 155 JPY (ref.). Use simulador da NTA Japan para valor exato.';
      breakdown = [
        { label: 'Salário Bruto', value: grossMonthly, type: 'gross' },
        { label: 'Saúde + Pensão (~14,15%)', value: -ss, type: 'deduction' },
        { label: 'Shotokuzei + Juminzei', value: -irsTax, type: 'deduction' },
        { label: 'Salário Líquido / mês', value: netMonthly, type: 'net' },
        { label: 'Rendimento Anual Líquido (×12)', value: netAnnual, type: 'annual' },
        { label: 'Taxa efetiva total', value: ((ss + irsTax) / grossMonthly * 100), type: 'rate' },
      ];
    }

    this.salaryCalc.results = { breakdown, notes, netMonthly, netAnnual, ss, irsTax };
  }

  // ── Income Tracker ──
  txModalOpen: boolean = false;
  txSaving: boolean = false;
  incomeTxFilter: string = 'todos';
  incomeFilterMonth: string = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  txEntries: any[] = [];
  newTx: any = { type: 'receita', description: '', amount: 0, date: new Date().toISOString().slice(0, 10), category: 'Salário' };

  loadTransactions() {
    this.userService.getTransactions().subscribe({
      next: (txs) => {
        this.txEntries = txs;
        // Sync to localStorage as offline cache
        localStorage.setItem('ws_tx_entries', JSON.stringify(txs));
      },
      error: () => {
        // Fallback to localStorage if backend unreachable
        this.txEntries = JSON.parse(localStorage.getItem('ws_tx_entries') || '[]');
      }
    });
  }

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
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
    if (!this.newTx.description.trim() || !this.newTx.amount || this.newTx.amount <= 0 || this.txSaving) return;
    this.txSaving = true;
    this.userService.addTransaction({
      type: this.newTx.type,
      description: this.newTx.description,
      amount: +this.newTx.amount,
      category: this.newTx.category,
      date: this.newTx.date
    }).subscribe({
      next: (saved) => {
        this.txEntries.push(saved);
        localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
        this.txModalOpen = false;
        this.txSaving = false;
      },
      error: () => {
        // Offline fallback — save locally
        const entry = { ...this.newTx, _id: 'local_' + Date.now(), amount: +this.newTx.amount };
        this.txEntries.push(entry);
        localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
        this.txModalOpen = false;
        this.txSaving = false;
      }
    });
  }

  deleteTxEntry(tx: any) {
    const id = tx._id || tx.id;
    if (id && !String(id).startsWith('local_')) {
      this.userService.deleteTransaction(id).subscribe({
        next: () => {
          this.txEntries = this.txEntries.filter(t => (t._id || t.id) !== id);
          localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
        },
        error: () => {
          this.txEntries = this.txEntries.filter(t => (t._id || t.id) !== id);
          localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
        }
      });
    } else {
      this.txEntries = this.txEntries.filter(t => (t._id || t.id) !== id);
      localStorage.setItem('ws_tx_entries', JSON.stringify(this.txEntries));
    }
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
        this.toast('Dados atualizados com sucesso!', 'success');
      },
      error: (err) => {
        this.savingFinancial = false;
        this.toast('Erro ao guardar dados: ' + (err.error?.message || err.message), 'error');
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

    // Group stackable items (containers, stickers, graffiti — no inspectLink) by name.
    // Weapons always stay individual even when float is unavailable.
    const grouped: any[] = [];
    const seen = new Map<string, any>();
    for (const item of filtered) {
      const isStackable = !item.inspectLink; // containers/stickers have no inspect link
      if (!isStackable) {
        // Weapon — always individual entry
        grouped.push({ ...item, groupedQty: 1, unitPrice: item.price });
      } else {
        if (seen.has(item.name)) {
          const g = seen.get(item.name);
          g.groupedQty++;
          // price stays as unit price; totalPrice = unitPrice * groupedQty
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
    this.loadSkinPriceHistory(skin.name);
  }

  loadSkinPriceHistory(name: string) {
    this.skinHistoryLoading = true;
    this.skinHistoryPolyline = '';
    this.skinHistoryFill = '';
    this.skinHistoryRaw = [];
    this.skinPriceOverview = null;
    this.http.get<{ history: { time: number; price: number }[]; priceOverview?: any }>(
      `${environment.apiUrl}/external/steam/price-history?name=${encodeURIComponent(name)}`
    ).subscribe({
      next: (res) => {
        this.skinHistoryRaw = (res.history || []).filter(p => p.price > 0);
        this.skinPriceOverview = res.priceOverview ?? null;
        this.skinHistoryLoading = false;
        this.renderSkinHistoryForPeriod();
      },
      error: () => { this.skinHistoryLoading = false; }
    });
  }

  setSkinHistoryPeriod(period: string) {
    this.skinHistoryPeriod = period;
    this.renderSkinHistoryForPeriod();
  }

  renderSkinHistoryForPeriod() {
    const periodObj = this.skinHistoryPeriods.find(p => p.key === this.skinHistoryPeriod) || this.skinHistoryPeriods[2];
    const cutoff = periodObj.days >= 9999 ? 0 : (Date.now() / 1000 - periodObj.days * 24 * 60 * 60);
    const pts = this.skinHistoryRaw.filter(p => p.time >= cutoff);
    if (pts.length < 2) {
      this.skinHistoryPolyline = '';
      this.skinHistoryFill = '';
      return;
    }
    const W = 400, H = 100, PAD = 4;
    const times = pts.map(p => p.time);
    const prices = pts.map(p => p.price);
    const minT = Math.min(...times), maxT = Math.max(...times);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    this.skinHistoryMin = minP;
    this.skinHistoryMax = maxP;
    this.skinHistoryFirst = prices[0];
    this.skinHistoryLast = prices[prices.length - 1];
    const rangeT = maxT - minT || 1;
    const rangeP = maxP - minP || 0.01;
    const points = pts.map(p => {
      const x = PAD + ((p.time - minT) / rangeT) * (W - 2 * PAD);
      const y = H - PAD - ((p.price - minP) / rangeP) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    this.skinHistoryPolyline = points.join(' ');
    this.skinHistoryFill = `${points.join(' ')} ${(W - PAD).toFixed(1)},${(H - PAD).toFixed(1)} ${PAD},${(H - PAD).toFixed(1)}`;
  }

  searchCs2Market() {
    clearTimeout(this.cs2MarketTimer);
    const q = this.cs2MarketQuery.trim();
    if (!q || q.length < 2) { this.cs2MarketResults = []; return; }
    this.cs2MarketSearching = true;
    this.cs2MarketTimer = setTimeout(() => {
      this.http.get<{results: any[]}>(`${environment.apiUrl}/external/steam/search?q=${encodeURIComponent(q)}&appid=730&count=12`)
        .subscribe({
          next: r => { this.cs2MarketResults = r.results || []; this.cs2MarketSearching = false; },
          error: () => { this.cs2MarketSearching = false; }
        });
    }, 350);
  }

  openSkinFromSearch(item: any) {
    // Open skin modal from market search
    const skin = {
      name: item.name,
      icon: item.icon || '',
      price: item.price || null,
      type: 'CS2 Market',
      mockVariation: 0,
      float: null,
      inspectLink: null,
      color: 'b0c3d9'
    };
    this.openSkinModal(skin);
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
    localStorage.setItem('ws_last_page', name);
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
      else {
        if (this.t212History.length >= 2) setTimeout(() => this.drawT212Chart(), 100);
        setTimeout(() => this.drawT212Treemap(), 150);
      }
      if (this.invSelectedStock) this.startInvAutoRefresh();
      if (this.invTrendingStocks.length === 0) this.loadTrending();
    } else {
      this.stopInvAutoRefresh();
    }
    if (name === 'cripto') {
      this.loadCryptoPrices();
      if (this.binanceBalances.length === 0) this.loadExternalBalances();
      if (this.cryptoTab === 'mercado') { this.startMarketRefresh(); this.loadTVChart(); }
    } else {
      this.stopMarketRefresh();
    }
    this.cdr.detectChanges();
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
        // Update topbar subtitle with live Euribor
        const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
        const euribor = data.euribor6m != null ? ` · Euribor 6M: ${data.euribor6m.toFixed(2)}%` : '';
        this.titles['dashboard'] = ['Dashboard', today + euribor];
        this.titles['taxas'] = ['Taxas & Mercados', 'Dados ao vivo · BCE · Banco de Portugal'];
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
    if (tab === 'watchlist') { this.loadWlSteamList(); if (this.wlSteamList.length) this.loadWlSteamPrices(); }
    if (tab === 'cripto') { this.loadCryptoPrices(); if (this.binanceBalances.length === 0) this.loadExternalBalances(); }
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
    .then(data => {
      this.forumPosts = Array.isArray(data) ? data : [];
      this.forumLoading = false;
      this.titles['comunidade'] = ['Comunidade', `${this.forumPosts.length} posts · Partilha estratégias`];
    })
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
    if (!token) return;
    fetch(`${environment.apiUrl}/forum/${post._id}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: dir })
    })
    .then(r => r.json())
    .then(data => {
      post.votes = data.votes;
      post.likedByMe = data.upvoted;
      post.dislikedByMe = data.downvoted;
    });
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
    .then(async r => {
      const data = await r.json();
      if (!r.ok) {
        this.toast(data.message || 'Erro ao publicar post', 'error');
        this.submittingPost = false;
        return;
      }
      if (data._id) { this.forumPosts.unshift(data); }
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
      .sort((a: any, b: any) => ((b.votes || 0) + (b.comments?.length || 0)) - ((a.votes || 0) + (a.comments?.length || 0)))
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
    const canvas = this.compareChartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Build real platform data
    const platforms = [
      { label: 'CS2', value: this.steamInventoryTotalValue || 0, color: '#7b9e7b' },
      { label: 'T212', value: this.t212Portfolio?.total || this.totalETF || 0, color: '#c97b6a' },
      { label: 'Binance', value: this.binanceTotalEur || 0, color: '#c9a84c' },
      { label: 'Kraken', value: this.krakenTotalEur || 0, color: '#8b7cc4' },
      { label: 'PayPal', value: this.paypalTotalEur || 0, color: '#009cde' },
    ].filter(p => p.value > 0);
    const W = canvas.offsetWidth || 600;
    const H = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    if (!platforms.length) {
      ctx.fillStyle = 'rgba(138,122,106,0.5)'; ctx.font = '13px DM Sans'; ctx.textAlign = 'center';
      ctx.fillText('Sem dados — liga as tuas contas nas Definições', W/2, H/2); return;
    }
    const maxVal = Math.max(...platforms.map(p => p.value)) * 1.15;
    const barW = Math.min(80, (W - 60) / platforms.length - 16);
    const spacing = (W - 40) / platforms.length;
    platforms.forEach((p, i) => {
      const barH = Math.max(4, (p.value / maxVal) * (H - 60));
      const x = 20 + i * spacing + spacing/2 - barW/2;
      const y = H - 36 - barH;
      const g = ctx.createLinearGradient(0, y, 0, y + barH);
      g.addColorStop(0, p.color + 'dd'); g.addColorStop(1, p.color + '66');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 6); ctx.fill();
      ctx.fillStyle = p.color; ctx.font = 'bold 11px DM Sans'; ctx.textAlign = 'center';
      ctx.fillText('€' + (p.value >= 1000 ? (p.value/1000).toFixed(1)+'k' : p.value.toFixed(0)), x + barW/2, y - 6);
      ctx.fillStyle = 'rgba(138,122,106,0.8)'; ctx.font = '11px DM Sans';
      ctx.fillText(p.label, x + barW/2, H - 12);
    });
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

  setSimTab(tab: string) {
    this.currentSimTab = tab;
    this.simView = 'details';
    setTimeout(() => {
      if (tab === 'juros') this.drawJurosChart();
      if (tab === 'fire') this.drawFireChart();
      if (tab === 'rendas') this.drawRendasChart();
      if (tab === 'inflacao') this.drawInflacaoChart();
    }, 50);
  }
  goBackToSimGrid() { this.simView = 'grid'; }

  addToWatchlist() {
    if (!this.invSelectedStock) return;
    this.toggleWatch(this.invSelectedStock);
  }

  calcJuros() {
    const { principal, monthly, rate, years } = this.simJuros;
    const r = rate / 100 / 12;
    const n = Math.max(1, years * 12);
    const futureValue = r === 0
      ? principal + monthly * n
      : principal * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
    const invested = principal + monthly * n;
    this.simJuros.results = {
      total: Math.round(futureValue),
      invested: Math.round(invested),
      profit: Math.round(futureValue - invested)
    };
    setTimeout(() => this.drawJurosChart(), 0);
  }

  drawJurosChart() {
    const canvas = this.jurosChartCanvas?.nativeElement;
    if (!canvas) return;
    const { principal, monthly, rate, years } = this.simJuros;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const r = rate / 100 / 12;
    const steps = Math.max(1, years);
    const investedData: number[] = [];
    const totalData: number[] = [];
    for (let y = 0; y <= steps; y++) {
      const n = y * 12;
      const fv = r === 0
        ? principal + monthly * n
        : principal * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
      investedData.push(principal + monthly * n);
      totalData.push(fv);
    }

    const maxVal = Math.max(...totalData);
    const pad = { top: 16, bottom: 28, left: 12, right: 12 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const xOf = (i: number) => pad.left + (i / steps) * cw;
    const yOf = (v: number) => pad.top + ch - (v / maxVal) * ch;

    ctx.clearRect(0, 0, W, H);

    // Gradient fill for total
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, 'rgba(138,181,130,0.35)');
    grad.addColorStop(1, 'rgba(138,181,130,0.02)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(totalData[0]));
    totalData.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(steps), H - pad.bottom);
    ctx.lineTo(xOf(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Total line
    ctx.beginPath();
    totalData.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#8ab582';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.stroke();

    // Invested dashed line
    ctx.beginPath();
    investedData.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = 'rgba(201,168,76,0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = 'rgba(180,170,155,0.7)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const labelStep = steps <= 10 ? 1 : Math.ceil(steps / 8);
    for (let y = 0; y <= steps; y += labelStep) {
      ctx.fillText('A' + y, xOf(y), H - 6);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8ab582';
    ctx.fillRect(pad.left, 4, 12, 3);
    ctx.fillStyle = 'rgba(180,170,155,0.8)';
    ctx.fillText('Total', pad.left + 16, 10);
    ctx.strokeStyle = 'rgba(201,168,76,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 5.5); ctx.lineTo(W / 2 + 12, 5.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,170,155,0.8)';
    ctx.fillText('Investido', W / 2 + 16, 10);
  }

  calcCH() {
    const { amount, years, euribor, spread } = this.simCH;
    const taxa = (euribor + spread) / 100 / 12;
    const n = Math.max(1, years * 12);
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

  getAmortSchedule(): { year: number; prestacao: number; juros: number; capital: number; saldo: number }[] {
    const { amount, years, euribor, spread } = this.simCH;
    const taxa = (euribor + spread) / 100 / 12;
    const n = Math.max(1, years * 12);
    const prestacao = taxa === 0 ? amount / n : amount * taxa / (1 - Math.pow(1 + taxa, -n));
    const rows = [];
    let saldo = amount;
    for (let y = 1; y <= Math.min(years, 30); y++) {
      let jurosAnual = 0, capitalAnual = 0;
      for (let m = 0; m < 12; m++) {
        const jurosMes = saldo * taxa;
        const capitalMes = prestacao - jurosMes;
        jurosAnual += jurosMes;
        capitalAnual += capitalMes;
        saldo = Math.max(0, saldo - capitalMes);
        if (saldo <= 0) break;
      }
      rows.push({
        year: y,
        prestacao: Math.round(prestacao * 12),
        juros: Math.round(jurosAnual),
        capital: Math.round(capitalAnual),
        saldo: Math.round(saldo)
      });
      if (saldo <= 0) break;
    }
    return rows;
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
    setTimeout(() => this.drawFireChart(), 0);
  }

  drawFireChart() {
    const canvas = this.fireChartCanvas?.nativeElement;
    if (!canvas) return;
    const { gastos, currentWealth, savings, return: ret } = this.simFIRE;
    const target = gastos * 12 * 25;
    const r = ret / 100 / 12;
    const maxMonths = Math.min(600, this.simFIRE.results.yearsToFire < 999
      ? Math.ceil(this.simFIRE.results.yearsToFire * 12) + 24
      : 360);

    const wealthData: number[] = [];
    let w = currentWealth;
    for (let m = 0; m <= maxMonths; m++) {
      wealthData.push(w);
      if (w < target) w = w * (1 + r) + savings;
    }
    const fireMonth = wealthData.findIndex(v => v >= target);
    const steps = wealthData.length - 1;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const maxVal = Math.max(target * 1.05, ...wealthData);
    const pad = { top: 16, bottom: 28, left: 12, right: 12 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const xOf = (i: number) => pad.left + (i / steps) * cw;
    const yOf = (v: number) => pad.top + ch - Math.min(1, v / maxVal) * ch;

    ctx.clearRect(0, 0, W, H);

    // FIRE target line
    const targetY = yOf(target);
    ctx.beginPath();
    ctx.moveTo(pad.left, targetY);
    ctx.lineTo(W - pad.right, targetY);
    ctx.strokeStyle = 'rgba(201,168,76,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(201,168,76,0.7)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('Número FIRE', W - pad.right - 4, targetY - 4);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, 'rgba(138,181,130,0.35)');
    grad.addColorStop(1, 'rgba(138,181,130,0.02)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(wealthData[0]));
    wealthData.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(steps), H - pad.bottom);
    ctx.lineTo(xOf(0), H - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Wealth line
    ctx.beginPath();
    wealthData.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#8ab582';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // FIRE point marker
    if (fireMonth > 0 && fireMonth <= steps) {
      const fx = xOf(fireMonth), fy = yOf(wealthData[fireMonth]);
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#e8a87c';
      ctx.fill();
    }

    // X labels (years)
    ctx.fillStyle = 'rgba(180,170,155,0.7)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const totalYears = Math.ceil(steps / 12);
    const labelStep = totalYears <= 10 ? 1 : Math.ceil(totalYears / 8);
    for (let y = 0; y <= totalYears; y += labelStep) {
      ctx.fillText('A' + y, xOf(y * 12), H - 6);
    }
  }

  drawRendasChart() {
    const canvas = this.rendasChartCanvas?.nativeElement;
    if (!canvas) return;
    const { valorImovel, renda, prestacao, despesas } = this.simRendas;
    if (valorImovel <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const years = 20;
    const cashflow = renda - prestacao - despesas;
    const cumulativeCashflow: number[] = [];
    const cumulativeCost: number[] = [];
    for (let y = 0; y <= years; y++) {
      cumulativeCashflow.push(cashflow * 12 * y);
      cumulativeCost.push(-(prestacao + despesas) * 12 * y);
    }

    const maxVal = Math.max(...cumulativeCashflow, valorImovel * 0.5);
    const minVal = Math.min(...cumulativeCashflow, 0);
    const range = maxVal - minVal;
    const pad = { top: 16, bottom: 28, left: 12, right: 12 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const xOf = (i: number) => pad.left + (i / years) * cw;
    const yOf = (v: number) => pad.top + ch - ((v - minVal) / range) * ch;

    ctx.clearRect(0, 0, W, H);

    // Zero line
    const zeroY = yOf(0);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(W - pad.right, zeroY);
    ctx.strokeStyle = 'rgba(180,170,155,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);

    // Cashflow area
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    const isPositive = cashflow >= 0;
    grad.addColorStop(0, isPositive ? 'rgba(138,181,130,0.35)' : 'rgba(210,100,80,0.25)');
    grad.addColorStop(1, 'rgba(138,181,130,0.02)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    cumulativeCashflow.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(years), yOf(0)); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Cashflow line
    ctx.beginPath();
    cumulativeCashflow.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = isPositive ? '#8ab582' : '#e07060';
    ctx.lineWidth = 2.5; ctx.stroke();

    // Payback marker
    if (cashflow > 0) {
      const paybackYears = valorImovel / (cashflow * 12);
      if (paybackYears <= years) {
        const px = xOf(paybackYears), py = yOf(0);
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e8a87c'; ctx.fill();
        ctx.fillStyle = 'rgba(201,168,76,0.8)'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('Payback', px, py - 8);
      }
    }

    // X labels
    ctx.fillStyle = 'rgba(180,170,155,0.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    const ls = years <= 10 ? 2 : 4;
    for (let y = 0; y <= years; y += ls) ctx.fillText('A' + y, xOf(y), H - 6);

    // Legend
    ctx.textAlign = 'left'; ctx.fillStyle = isPositive ? '#8ab582' : '#e07060';
    ctx.fillRect(pad.left, 4, 12, 3);
    ctx.fillStyle = 'rgba(180,170,155,0.8)'; ctx.fillText('Cashflow acumulado', pad.left + 16, 10);
  }

  drawInflacaoChart() {
    const canvas = this.inflacaoChartCanvas?.nativeElement;
    if (!canvas) return;
    const { valor, taxa, anos, retorno } = this.simInflacao;
    if (valor <= 0 || anos <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 600;
    const H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const poderCompraData: number[] = [];
    const investidoData: number[] = [];
    for (let y = 0; y <= anos; y++) {
      poderCompraData.push(valor / Math.pow(1 + taxa / 100, y));
      investidoData.push(valor * Math.pow(1 + retorno / 100, y));
    }

    const maxVal = Math.max(...investidoData);
    const minVal = Math.min(...poderCompraData, valor * 0.3);
    const range = maxVal - minVal || 1;
    const pad = { top: 16, bottom: 28, left: 12, right: 12 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const xOf = (i: number) => pad.left + (i / anos) * cw;
    const yOf = (v: number) => pad.top + ch - ((v - minVal) / range) * ch;

    ctx.clearRect(0, 0, W, H);

    // Invested gradient fill
    const gradInv = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    gradInv.addColorStop(0, 'rgba(138,181,130,0.3)');
    gradInv.addColorStop(1, 'rgba(138,181,130,0.02)');
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(investidoData[0]));
    investidoData.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(anos), H - pad.bottom); ctx.lineTo(xOf(0), H - pad.bottom); ctx.closePath();
    ctx.fillStyle = gradInv; ctx.fill();

    // Invested line
    ctx.beginPath();
    investidoData.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#8ab582'; ctx.lineWidth = 2.5; ctx.setLineDash([]); ctx.stroke();

    // Purchasing power line (dashed red)
    ctx.beginPath();
    poderCompraData.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
    ctx.strokeStyle = 'rgba(210,100,80,0.8)'; ctx.lineWidth = 1.8; ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);

    // Original value line
    const origY = yOf(valor);
    ctx.beginPath(); ctx.moveTo(pad.left, origY); ctx.lineTo(W - pad.right, origY);
    ctx.strokeStyle = 'rgba(180,170,155,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);

    // X labels
    ctx.fillStyle = 'rgba(180,170,155,0.7)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    const ls = anos <= 10 ? 1 : Math.ceil(anos / 8);
    for (let y = 0; y <= anos; y += ls) ctx.fillText('A' + y, xOf(y), H - 6);

    // Legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8ab582'; ctx.fillRect(pad.left, 4, 12, 3);
    ctx.fillStyle = 'rgba(180,170,155,0.8)'; ctx.fillText('Investido', pad.left + 16, 10);
    ctx.strokeStyle = 'rgba(210,100,80,0.8)'; ctx.lineWidth = 1.8; ctx.setLineDash([5,3]);
    ctx.beginPath(); ctx.moveTo(W/2, 5.5); ctx.lineTo(W/2 + 12, 5.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,170,155,0.8)'; ctx.fillText('Poder de compra', W/2 + 16, 10);
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
    setTimeout(() => this.drawRendasChart(), 0);
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
    setTimeout(() => this.drawInflacaoChart(), 0);
  }

  calcDeposito() {
    const { capital, taxa, anos, periodicidade } = this.simDeposito;
    const taxaP = taxa / 100 / periodicidade;
    const n = anos * periodicidade;
    const capitalFinal = capital * Math.pow(1 + taxaP, n);
    const jurosBrutos = capitalFinal - capital;
    const irs = jurosBrutos * 0.28;
    const jurosLiquidos = jurosBrutos - irs;
    const depositosBancos = [
      { bank: 'CGD Depósito Mais', taxa: 2.75, prazo: '12 meses', nota: 'Renovação automática' },
      { bank: 'BPI Poupança', taxa: 3.00, prazo: '6-12 meses', nota: 'Depósito online' },
      { bank: 'Novo Banco', taxa: 3.25, prazo: '12 meses', nota: 'Clientes novos' },
      { bank: 'Santander', taxa: 2.90, prazo: '12 meses', nota: 'MySavings' },
      { bank: 'Montepio', taxa: 2.80, prazo: '6 meses', nota: 'Conta Poupança' },
      { bank: 'Banco CTT', taxa: 3.50, prazo: '12 meses', nota: 'Conta Confiança' },
      { bank: 'Trade Republic', taxa: 3.75, prazo: 'À ordem', nota: 'Juro diário (UE)' }
    ];
    this.simDeposito.results = {
      capitalFinal,
      jurosBrutos,
      irs,
      jurosLiquidos,
      capitalFinalLiquido: capital + jurosLiquidos,
      taxaEfetiva: (jurosBrutos / capital / anos) * 100,
      taxaEfetivaLiquida: (jurosLiquidos / capital / anos) * 100,
      depositosBancos: depositosBancos.map(b => ({
        ...b,
        jurosLiquidos: capital * (b.taxa / 100) * anos * 0.72
      }))
    };
  }

  calcMaisValias() {
    const mv = this.simMaisValias;
    const comissaoEur = mv.valorVenda * mv.comissao / 100;
    const custosDedutiveis = mv.obras + comissaoEur + mv.outrosCustos;
    const maisValiaBruta = mv.valorVenda - mv.valorAquisicao - custosDedutiveis;
    // 50% exclusão para habitação própria permanente residente (art. 10º CIRS)
    const exclusaoPct = (mv.habitacaoPropria && mv.residente) ? 0.5 : 0;
    const valorExcluido = Math.max(0, maisValiaBruta) * exclusaoPct;
    const baseTributavel = Math.max(0, maisValiaBruta - valorExcluido);
    const taxaIRS = mv.residente ? 0.28 : 0.28; // 28% residentes e não-residentes para imóveis
    const irsDever = baseTributavel * taxaIRS;
    const lucroLiquido = maisValiaBruta - irsDever;
    this.simMaisValias.results = {
      maisValiaBruta,
      custosDedutiveis,
      comissaoEur,
      valorExcluido,
      baseTributavel,
      irsDever,
      lucroLiquido,
      rendimentoLiquido: mv.valorVenda - mv.valorAquisicao - custosDedutiveis - irsDever
    };
  }

  calcSimAll() {
    this.calcJuros();
    this.calcCH();
    this.calcCarro();
    this.calcPessoal();
    this.calcFIRE();
    this.calcRendas();
    this.calcInflacao();
    this.calcDeposito();
    this.calcMaisValias();
  }

  loadDashNews(topicKey?: string, _retryCount = 0) {
    if (topicKey) this.dashNewsTopic = topicKey;
    const topic = this.dashNewsTopics.find(t => t.key === this.dashNewsTopic);
    if (!topic) return;
    this.dashNewsLoading = true;
    if (_retryCount === 0) this.dashNewsItems = [];
    this.userService.getStockNews(topic.symbol).subscribe({
      next: (items: any[]) => {
        this.dashNewsItems = items.slice(0, 8);
        this.dashNewsLoading = false;
      },
      error: () => {
        if (_retryCount < 3) {
          // Backend (Render.com free tier) may be cold-starting — retry with backoff
          setTimeout(() => this.loadDashNews(undefined, _retryCount + 1), 10000);
        } else {
          this.dashNewsLoading = false;
        }
      }
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
}

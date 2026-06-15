import { Component, AfterViewInit, ElementRef, ViewChild, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-dashboard-demo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-demo.component.html',
  styleUrls: ['./dashboard-demo.component.css']
})
export class DashboardDemoComponent implements OnInit, AfterViewInit {
  @ViewChild('patrimonioChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  private readonly route = inject(ActivatedRoute);

  currentPage: string = 'dashboard';
  modalOpen: boolean = false;
  currentChartPeriod: string = '6m';
  isDark: boolean = true;

  titles: { [key: string]: [string, string] } = {
    dashboard: ['Dashboard', 'Domingo, 10 de Maio · Euribor 6M: 3.02% ↓'],
    income: ['Income Tracker', 'Maio 2025 · €1.920 de receitas'],
    taxas: ['Taxas & Mercados', 'Dados em tempo real · BCE · Banco de Portugal'],
    cs2: ['CS2 & Steam', 'Inventário sincronizado · 14 itens · €624'],
    comunidade: ['Comunidade', '487 membros ativos · 1.240 posts'],
    rendas: ['Rendas & Imóveis', '2 imóveis · €1.200/mês'],
    simulador: ['Simulador', 'Juros compostos · FIRE · Amortizações'],
    perfil: ['Perfil', 'João Silva · Lisboa 🇵🇹'],
  };

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

  data = {
    '6m': {
      networth: [36200, 37100, 38400, 39200, 40100, 41500, 42800],
      etf: [15200, 15800, 16400, 16900, 17200, 17800, 18400],
      rendas: [10800, 10800, 10800, 11500, 11500, 12000, 12000]
    },
    '1a': {
      networth: [28000, 29500, 31000, 32800, 34200, 35600, 37100, 38400, 39200, 40100, 41500, 42800, 42800],
      etf: [11000, 11800, 12400, 13200, 14000, 14800, 15200, 15800, 16400, 16900, 17200, 17800, 18400],
      rendas: [8400, 8400, 9000, 9000, 9600, 10200, 10800, 10800, 10800, 11500, 11500, 12000, 12000]
    },
    '3a': {
      networth: [12000, 14500, 17000, 19800, 22000, 24500, 27000, 29500, 32000, 35000, 38000, 40500, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800, 42800],
      etf: [4000, 5200, 6400, 7600, 8800, 9800, 10800, 11800, 12800, 13800, 14800, 15800, 16800, 17400, 18000, 18400, 18400, 18400, 18400, 18400, 18400, 18400, 18400, 18400, 18400],
      rendas: [0, 0, 2400, 2400, 4800, 4800, 7200, 7200, 8400, 8400, 9600, 10200, 10800, 11000, 11200, 11500, 11800, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000]
    }
  };

  ngOnInit(): void {
    this.loadTheme();
    const page = this.route.snapshot.queryParamMap.get('page');
    if (page && this.titles[page]) {
      this.currentPage = page;
    }
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
  }

  openModal() {
    this.modalOpen = true;
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
    const maxV = Math.max(...allVals);
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
}

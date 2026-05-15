import { Component, AfterViewInit, ElementRef, ViewChild, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-dashboard-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-user.component.html',
  styleUrls: ['./dashboard-user.component.css']
})
export class DashboardUserComponent implements OnInit, AfterViewInit {
  @ViewChild('patrimonioChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  currentPage: string = 'dashboard';
  modalOpen: boolean = false;
  currentChartPeriod: string = '6m';
  
  userName: string = 'Utilizador';
  userInitial: string = 'U';

  titles: { [key: string]: [string, string] } = {
    dashboard: ['Dashboard', 'Domingo, 10 de Maio · Euribor 6M: 2.55% ↓'],
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

  steamInventory: any = null;
  steamLoading: boolean = false;
  steamError: string = '';

  ngOnInit() {
    const userStr = localStorage.getItem('wealthsphere_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user && user.name) {
          this.userName = user.name;
          this.userInitial = user.name.charAt(0).toUpperCase();
          this.titles['perfil'] = ['Perfil', `${this.userName} · Lisboa 🇵🇹`];
        }
      } catch (e) {
        console.error('Error parsing user', e);
      }
    }
    this.loadProfile();
  }

  loginWithSteam() {
    window.location.href = `${environment.apiUrl}/auth/steam`;
  }

  loadProfile() {
    this.userService.getProfile().subscribe({
      next: (res) => {
        const profile = res.profile;
        if (profile.externalApis?.steam?.steamId) {
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
}

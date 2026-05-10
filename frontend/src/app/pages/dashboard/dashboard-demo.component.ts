import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemoService } from '../../services/demo.service';

@Component({
  selector: 'app-dashboard-demo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-demo.component.html',
  styleUrl: './dashboard-demo.component.css'
})
export class DashboardDemoComponent implements OnInit {
  isDemoMode = true;
  activeSection = 'overview';
  user = {
    name: 'Demo User',
    email: 'demo@wealthsphere.pt',
    avatar: 'DU',
    role: 'Premium Demo'
  };

  portfolioData = {
    totalValue: 125430,
    monthlyChange: 2.34,
    yearlyReturn: 18.7,
    riskScore: 6
  };

  assets = [
    { name: 'VWCE - Vanguard World', value: 45200, change: 2.1, percentage: 36.0 },
    { name: 'ETF Tech Nasdaq', value: 28300, change: 3.4, percentage: 22.6 },
    { name: 'Ouro Físico', value: 15600, change: -0.8, percentage: 12.4 },
    { name: 'Imóveis Lisboa', value: 22400, change: 1.2, percentage: 17.9 },
    { name: 'Crypto Portfolio', value: 13930, change: 5.6, percentage: 11.1 }
  ];

  recentTransactions = [
    { date: '2024-01-10', description: 'Compra VWCE', amount: -500, type: 'investment' },
    { date: '2024-01-08', description: 'Dividendos ETF Tech', amount: 125, type: 'dividend' },
    { date: '2024-01-05', description: 'Renda Apartamento', amount: 850, type: 'income' },
    { date: '2024-01-03', description: 'Venda Crypto', amount: 320, type: 'sale' }
  ];

  alerts = [
    { type: 'warning', message: 'VWCE abaixo da média móvel de 50 dias' },
    { type: 'info', message: 'Nova taxa Euribor 6M: 2.61%' },
    { type: 'success', message: 'Meta mensal de poupança alcançada!' }
  ];

  constructor(private demoService: DemoService) {}

  ngOnInit() {
    // Inicializar dados demo
  }

  switchSection(section: string) {
    this.activeSection = section;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${value > 0 ? '+' : ''}${value}%`;
  }

  getChangeClass(value: number): string {
    return value >= 0 ? 'positive' : 'negative';
  }

  getAlertIcon(type: string): string {
    switch(type) {
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📢';
    }
  }
}

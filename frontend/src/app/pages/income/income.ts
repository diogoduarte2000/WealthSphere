import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemoService } from '../../services/demo.service';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './income.html',
  styleUrl: './income.css'
})
export class IncomeComponent implements OnInit {
  incomeData: any = null;
  selectedView: 'summary' | 'income' | 'expenses' | 'trends' = 'summary';

  constructor(private demoService: DemoService) {}

  ngOnInit() {
    this.loadIncomeData();
  }

  loadIncomeData() {
    this.incomeData = this.demoService.getIncomeData();
  }

  changeView(view: 'summary' | 'income' | 'expenses' | 'trends') {
    this.selectedView = view;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  getBalanceColor(): string {
    if (this.incomeData?.balance > 0) return '#10b981';
    if (this.incomeData?.balance < 0) return '#ef4444';
    return '#6b7280';
  }

  addIncomeDemo() {
    // Demo functionality - would normally open a form
    alert('🎮 Modo Demo: Adicionar rendimento\n\nNuma versão real, aqui poderia adicionar novos rendimentos como salário, freelances, investimentos, etc.');
  }

  addExpenseDemo() {
    // Demo functionality - would normally open a form
    alert('🎮 Modo Demo: Adicionar despesa\n\nNuma versão real, aqui poderia adicionar despesas categorizadas como alimentação, transporte, habitação, etc.');
  }

  exportDataDemo() {
    // Demo functionality - would normally export CSV/PDF
    alert('🎮 Modo Demo: Exportar dados\n\nNuma versão real, poderia exportar os seus dados financeiros em CSV ou PDF para análise externa.');
  }
}

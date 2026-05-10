import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DemoService } from '../../services/demo.service';

@Component({
  selector: 'app-simulador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulador.html',
  styleUrl: './simulador.css'
})
export class SimuladorComponent implements OnInit {
  simulationParams = {
    initialAmount: 1000,
    monthlyContribution: 200,
    annualRate: 7,
    years: 10
  };

  simulationResults: any = null;
  predefinedSimulations: any[] = [];
  selectedSimulation: any = null;

  constructor(private demoService: DemoService) {}

  ngOnInit() {
    this.predefinedSimulations = this.demoService.getPredefinedSimulations();
    this.runSimulation();
  }

  runSimulation() {
    this.simulationResults = this.demoService.getSimulationResults(this.simulationParams);
  }

  selectPredefinedSimulation(simulation: any) {
    this.selectedSimulation = simulation;
    this.simulationParams = { ...simulation };
    this.runSimulation();
  }

  updateParam(param: keyof typeof this.simulationParams, value: number) {
    this.simulationParams[param] = value;
    this.runSimulation();
  }

  onInputChange(param: keyof typeof this.simulationParams, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    this.updateParam(param, value);
  }

  onYearsChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value) || 0;
    this.updateParam('years', value);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${value}%`;
  }

  resetSimulation() {
    this.simulationParams = {
      initialAmount: 1000,
      monthlyContribution: 200,
      annualRate: 7,
      years: 10
    };
    this.selectedSimulation = null;
    this.runSimulation();
  }

  exportResultsDemo() {
    alert('🎮 Modo Demo: Exportar resultados\n\nNuma versão real, poderia exportar os resultados da simulação em PDF ou CSV para partilhar ou guardar para referência futura.');
  }

  saveScenarioDemo() {
    alert('🎮 Modo Demo: Guardar cenário\n\nNuma versão real, poderia guardar este cenário de investimento para comparar com outras simulações no futuro.');
  }
}

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DemoService {
  
  // Dados demo para o fórum
  getForumPosts() {
    return [
      {
        id: 1,
        title: 'Como começar a investir em 2024?',
        author: 'InvestidorIniciante',
        avatar: '👤',
        content: 'Olá a todos! Estou a começar a investir e gostava de saber quais são as melhores estratégias para quem está a começar...',
        tags: ['investimento', 'iniciante', 'estratégia'],
        upvotes: 42,
        downvotes: 3,
        comments: 15,
        createdAt: '2024-01-15T10:30:00Z',
        isPinned: true
      },
      {
        id: 2,
        title: 'Análise do mercado imobiliário em Lisboa',
        author: 'EspecialistaImobiliário',
        avatar: '🏠',
        content: 'Nos últimos meses, o mercado imobiliário em Lisboa tem mostrado sinais de estabilização. Analisando os dados...',
        tags: ['imobiliário', 'lisboa', 'análise'],
        upvotes: 28,
        downvotes: 1,
        comments: 8,
        createdAt: '2024-01-14T15:45:00Z',
        isPinned: false
      },
      {
        id: 3,
        title: 'Dicas para poupança mensal eficaz',
        author: 'PoupadorMaster',
        avatar: '💰',
        content: 'Queria partilhar algumas estratégias que me ajudaram a poupar mais de 30% do meu salário todos os meses...',
        tags: ['poupança', 'orçamento', 'dicas'],
        upvotes: 67,
        downvotes: 5,
        comments: 23,
        createdAt: '2024-01-13T09:20:00Z',
        isPinned: false
      }
    ];
  }

  getComments(postId: number) {
    return [
      {
        id: 1,
        author: 'ComentadorExperiente',
        avatar: '🎯',
        content: 'Excelente análise! Concordo totalmente com a sua perspetiva sobre o mercado atual.',
        upvotes: 12,
        downvotes: 0,
        createdAt: '2024-01-15T11:00:00Z'
      },
      {
        id: 2,
        author: 'NovoInvestidor',
        avatar: '🌟',
        content: 'Obrigado por partilhar! Esta informação é muito útil para quem está a começar.',
        upvotes: 8,
        downvotes: 1,
        createdAt: '2024-01-15T11:30:00Z'
      }
    ];
  }

  // Dados demo para income tracker
  getIncomeData() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return {
      summary: {
        totalIncome: 3500,
        totalExpenses: 2100,
        balance: 1400,
        savingsRate: 40,
        month: new Date(currentYear, currentMonth, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      },
      incomeBreakdown: [
        { category: 'Salário', amount: 3000, percentage: 85.7, color: '#4F46E5' },
        { category: 'Freelance', amount: 400, percentage: 11.4, color: '#10B981' },
        { category: 'Investimentos', amount: 100, percentage: 2.9, color: '#F59E0B' }
      ],
      expenseBreakdown: [
        { category: 'Habitação', amount: 800, percentage: 38.1, color: '#EF4444' },
        { category: 'Alimentação', amount: 400, percentage: 19.0, color: '#F97316' },
        { category: 'Transporte', amount: 200, percentage: 9.5, color: '#EAB308' },
        { category: 'Utilidades', amount: 150, percentage: 7.1, color: '#84CC16' },
        { category: 'Lazer', amount: 300, percentage: 14.3, color: '#06B6D4' },
        { category: 'Outros', amount: 250, percentage: 11.9, color: '#8B5CF6' }
      ],
      monthlyTrend: [
        { month: 'Jan', income: 3200, expenses: 2000 },
        { month: 'Fev', income: 3300, expenses: 2100 },
        { month: 'Mar', income: 3400, expenses: 1900 },
        { month: 'Abr', income: 3500, expenses: 2200 },
        { month: 'Mai', income: 3500, expenses: 2100 },
        { month: 'Jun', income: 3600, expenses: 2000 }
      ]
    };
  }

  // Dados demo para simulador
  getSimulationResults(params: {
    initialAmount: number;
    monthlyContribution: number;
    annualRate: number;
    years: number;
  }) {
    const { initialAmount, monthlyContribution, annualRate, years } = params;
    const monthlyRate = annualRate / 100 / 12;
    
    let totalContributed = initialAmount;
    let currentValue = initialAmount;
    const yearlyData = [];
    
    for (let year = 1; year <= years; year++) {
      const yearStartValue = currentValue;
      
      for (let month = 1; month <= 12; month++) {
        currentValue = currentValue * (1 + monthlyRate) + monthlyContribution;
        totalContributed += monthlyContribution;
      }
      
      yearlyData.push({
        year,
        startValue: yearStartValue,
        endValue: currentValue,
        contributions: totalContributed,
        earnings: currentValue - totalContributed
      });
    }
    
    return {
      finalAmount: currentValue,
      totalContributed: totalContributed,
      totalEarnings: currentValue - totalContributed,
      roi: ((currentValue - totalContributed) / totalContributed * 100).toFixed(2),
      yearlyData
    };
  }

  // Simulações predefinidas
  getPredefinedSimulations() {
    return [
      {
        name: 'Investidor Conservador',
        initialAmount: 1000,
        monthlyContribution: 200,
        annualRate: 4,
        years: 10
      },
      {
        name: 'Investidor Moderado',
        initialAmount: 5000,
        monthlyContribution: 500,
        annualRate: 7,
        years: 15
      },
      {
        name: 'Investidor Agressivo',
        initialAmount: 10000,
        monthlyContribution: 1000,
        annualRate: 12,
        years: 20
      }
    ];
  }

  constructor() { }
}

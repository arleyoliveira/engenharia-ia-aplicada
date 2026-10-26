import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BragService } from '../../services/brag.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly bragService = inject(BragService);

  // Signals do serviço
  readonly brags = this.bragService.brags;
  readonly loading = this.bragService.loading;

  // Signal local para a entrada do usuário
  readonly rawPrompt = signal<string>('');

  // Sugestões rápidas para facilitar testes imediatos (tema BTG Pactual)
  readonly promptSuggestions = [
    {
      label: '🚀 Pipeline RAG & Cache',
      text: 'Implementei um pipeline de RAG para análise semântica em base de dados com Firestore Vector Search e Gemini 3.8 Flash no BTG Pactual, diminuindo os custos com tokens em 60% e mantendo latência abaixo de 890ms.'
    },
    {
      label: '🤖 Agente com MCP & Validação',
      text: 'Construí um agente autônomo com Genkit e Model Context Protocol (MCP) para automação de validações técnicas e auditoria de contratos, acelerando a triagem de 4h para 6 minutos com 99.8% de precisão.'
    },
    {
      label: '⚡ Otimização com Flash-Lite',
      text: 'Migrei cargas analíticas de alta frequência para o Gemini 3.5 Flash-Lite com structured output, economizando R$ 38.000 mensais com zero perda de conformidade nos relatórios executivos.'
    }
  ];

  onInputChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.rawPrompt.set(target.value);
  }

  setPrompt(text: string): void {
    this.rawPrompt.set(text);
  }

  async onSubmit(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const text = this.rawPrompt().trim();
    if (!text || this.loading()) return;

    await this.bragService.generateMockBrag(text);
    this.rawPrompt.set('');
  }
}

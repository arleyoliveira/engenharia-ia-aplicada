import { Injectable, signal } from '@angular/core';
import { BragItem } from '../models/brag.model';

const STORAGE_KEY = 'btg_brag_items';
const LEGACY_STORAGE_KEY = 'unipds_brag_items';

const DEFAULT_BRAGS: BragItem[] = [
  {
    id: 'brag-1',
    title: 'Pipeline RAG com Gemini 3.8 Flash e Cache Semântico',
    context: 'Desenvolvimento de uma arquitetura RAG de alta disponibilidade para a esteira de análise institucional e atendimento corporativo no BTG Pactual, processando relatórios financeiros, documentações de compliance e SLAs críticos com mais de 2 milhões de tokens diários.',
    impact: 'Redução drástica de 72% na latência de resposta das consultas analíticas e diminuição de 58% nos custos de tokens graças ao cache semântico e context caching do Gemini.',
    metrics: '72% menor latência (de 3.2s para 890ms) | R$ 38.000/mês economizados em infraestrutura',
    technologies: ['Gemini 3.8 Flash', 'Genkit', 'Firestore Vector Search', 'Node.js', 'Angular 22'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 dias atrás
    rawPrompt: 'Criei uma pipeline de RAG para suporte com Gemini Flash e cache, baixou a latência em 70% e reduziu custo de token.'
  },
  {
    id: 'brag-2',
    title: 'Sistema Autônomo Multi-Agente com Tool Calling & MCP',
    context: 'Implementação de orquestração multi-agente utilizando Genkit e protocolo MCP (Model Context Protocol) para auditoria contínua de transações, validação de pull requests e conformidade de sistemas no BTG Pactual.',
    impact: 'Aceleração do ciclo de triagem técnica e mitigação de vulnerabilidades antes do deploy em esteiras de liquidação, alcançando 99.8% de precisão.',
    metrics: 'Tempo de validação reduzido de 4h para 6 minutos | 140+ PRs e fluxos auditados por semana',
    technologies: ['Genkit Agents', 'Model Context Protocol (MCP)', 'TypeScript', 'Docker', 'Google AI'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 horas atrás
    rawPrompt: 'Fiz um sistema multi-agente com MCP pra analisar PR e triar bugs automaticamente com Genkit.'
  }
];

function loadInitialBrags(): BragItem[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt)
          }));
        }
      }
    } catch {
      // Ignora falhas de parsing e usa o padrão
    }
  }
  return DEFAULT_BRAGS;
}

@Injectable({
  providedIn: 'root'
})
export class BragService {
  // Signal guardando o array de conquistas (com inicialização resiliente)
  readonly brags = signal<BragItem[]>(loadInitialBrags());

  // Signal booleano indicando estado de carregamento
  readonly loading = signal<boolean>(false);

  /**
   * Simula chamada de rede (1.5s), ativa o loading e adiciona uma conquista mockada
   */
  async generateMockBrag(prompt: string): Promise<BragItem> {
    this.loading.set(true);

    try {
      // Simula latência de rede de 1.5s
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newId = `brag-${Date.now()}`;
      const trimmedPrompt = prompt.trim();

      // Objeto JSON mockado com Título, Contexto, Impacto, Métrica e Tecnologias
      const mockBrag: BragItem = {
        id: newId,
        title: trimmedPrompt 
          ? `Otimização de Arquitetura: ${this.summarizeTitle(trimmedPrompt)}`
          : 'Automação Inteligente com Genkit & Engenharia de Prompts',
        context: trimmedPrompt
          ? `Aplicação de técnicas avançadas de Engenharia de IA para resolver o desafio: "${trimmedPrompt}". Desenvolvido no ecossistema de alta disponibilidade do BTG Pactual.`
          : 'Refatoração da arquitetura de microsserviços integrando agentes inteligentes do Google GenAI com Genkit para processamento distribuído de demandas em tempo real.',
        impact: 'Aumento significativo na eficiência operacional da equipe, eliminando gargalos manuais e garantindo conformidade com padrões corporativos e de alta disponibilidade.',
        metrics: '84% de ganho de produtividade operacional | 0 falhas em produção nos primeiros 30 dias',
        technologies: ['Genkit 1.43', 'Gemini 3.8 Flash', 'Google Cloud', 'Tailwind CSS', 'Angular Signals'],
        createdAt: new Date(),
        rawPrompt: trimmedPrompt || 'Implementação de solução de inteligência artificial aplicada.'
      };

      // Atualiza a lista de brags adicionando a nova conquista no topo e persiste
      this.brags.update((current) => {
        const updated = [mockBrag, ...current];
        this.saveToStorage(updated);
        return updated;
      });

      return mockBrag;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Busca uma conquista pelo ID
   */
  getBragById(id: string): BragItem | undefined {
    return this.brags().find((b) => b.id === id);
  }

  private saveToStorage(items: BragItem[]): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Fallback silencioso para ambientes restritos
      }
    }
  }

  private summarizeTitle(prompt: string): string {
    const clean = prompt.replace(/[^\w\sÀ-ÿ]/gi, '').trim();
    const words = clean.split(/\s+/);
    if (words.length <= 6) return clean;
    return words.slice(0, 6).join(' ') + '...';
  }
}

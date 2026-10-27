import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  private readonly http = inject(HttpClient);

  // Signal guardando o array de conquistas (com inicialização resiliente)
  readonly brags = signal<BragItem[]>(loadInitialBrags());

  // Signal booleano indicando estado de carregamento
  readonly loading = signal<boolean>(false);

  /**
   * Envia o rascunho (definition) para a rota /api/brag, liga o loading,
   * adiciona a resposta ao signal brags e desliga o loading.
   */
  async generateBrag(definition: string): Promise<BragItem> {
    this.loading.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<any>('/api/brag', { definition })
      );

      const newBrag: BragItem = {
        ...response,
        id: response.id || `brag-${Date.now()}`,
        title: response.title || 'Conquista Destilada',
        context: response.context || '',
        actionTaken: response.actionTaken,
        businessImpact: response.businessImpact,
        impact: response.businessImpact || response.impact || '',
        metrics: Array.isArray(response.metrics)
          ? response.metrics.join(' | ')
          : (response.metrics || ''),
        technologies: response.technologiesUsed || response.technologies || [],
        technologiesUsed: response.technologiesUsed || response.technologies || [],
        createdAt: response.createdAt ? new Date(response.createdAt) : new Date(),
        rawPrompt: definition,
      };

      this.brags.update((current) => {
        const updated = [newBrag, ...current];
        this.saveToStorage(updated);
        return updated;
      });

      return newBrag;
    } catch (error) {
      console.error('Erro ao gerar conquista com Brag-Bot:', error);
      throw error;
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
}


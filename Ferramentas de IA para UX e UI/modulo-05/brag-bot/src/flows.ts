import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { v4 as uuidv4 } from 'uuid';

// Carrega automaticamente variáveis do arquivo .env de forma nativa caso exista
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Ignora caso .env não esteja presente no ambiente
  }
}


const DEFAULT_MODEL = process.env['GENKIT_MODEL'] || 'gemini-flash-latest';

/**
 * Inicialização da instância do Genkit com o plugin Google AI.
 * Configurado com o modelo padrão 'gemini-flash-latest' (ou GENKIT_MODEL) e temperatura 0.8.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(DEFAULT_MODEL, {
    temperature: 0.8,
  }),
});


/**
 * Schema de entrada para o fluxo (rascunho informal do usuário)
 */
export const BragInputSchema = z.object({
  definition: z
    .string()
    .describe('Rascunho informal ou anotações brutas do usuário sobre suas realizações no trabalho'),
});

/**
 * Alias de compatibilidade para garantir resolução caso referenciado com variação de casing
 */
export const BraginputSchema = BragInputSchema;

/**
 * Schema de saída rigoroso em JSON para a LLM (Brag Document estruturado)
 */
export const BragSchema = z.object({
  title: z
    .string()
    .describe('Ex: Ação principal + Resultado de alto nível'),
  context: z
    .string()
    .describe('Situação/Problema original. O que estava quebrado, lento, etc.'),
  actionTaken: z
    .string()
    .describe('Ação técnica ou estratégica passo a passo tomada para resolver o problema'),
  businessImpact: z
    .string()
    .describe('Qual o impacto de negócio. Tempo ganho, redução de falhas, etc.'),
  metrics: z
    .array(z.string())
    .describe('Apenas dados estritamente quantificáveis. Ex: "50% reduction"'),
  technologiesUsed: z
    .array(z.string())
    .describe('Ferramentas, linguagens e plataformas mencionadas ou inferidas'),
});

/**
 * Schema estendido contendo o identificador único gerado nativamente
 */
export const BragOutputSchema = BragSchema.extend({
  id: z
    .string()
    .describe('Identificador único gerado nativamente via UUID v4'),
});

export type BragInput = z.infer<typeof BragInputSchema>;
export type Brag = z.infer<typeof BragSchema>;
export type BragOutput = z.infer<typeof BragOutputSchema>;

/**
 * Fluxo bragGeneratorFlow: transforma rascunhos informais em Brag Documents executivos
 */
export const bragGeneratorFlow = ai.defineFlow(
  {
    name: 'bragGeneratorFlow',
    inputSchema: BragInputSchema,
    outputSchema: BragSchema,
  },
  async (input) => {
    // Construção do prompt seguindo persona, objetivo e regras estritas
    const prompt = `Você é um "Senior Career Consultant" focado em Planos de Desenvolvimento Individual (IDP) para Engenheiros de Software.

Objetivo:
Transformar o rascunho informal do usuário em um "Brag Document" executivo.

Regras obrigatórias:
- Regra 1: Usar tom profissional, objetivo e focado em impacto, sem adjetivos emocionais.
- Regra 2: Se não existirem métricas exatas, a IA deve inferir a natureza da métrica baseada na ação tomada.
- Regra 3: Seguir ESTRITAMENTE o formato do schema JSON ("BragSchema").
- Regra 4: O output deve respeitar a linguagem original do input (se mandou em português, responde em português).

Rascunho informal do usuário:
${input.definition}`;

    // Chamada à geração de conteúdo do Genkit com schema de saída e retry resiliente a picos 503
    let response;
    try {
      response = await ai.generate({
        prompt,
        output: { schema: BragSchema },
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      // Se for pico de alta demanda (503 Service Unavailable / UNAVAILABLE), faz fallback para o modelo estável gemini-3.5-flash
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('fetch failed')) {
        console.warn('Detectado pico de alta demanda no modelo padrão. Realizando fallback para gemini-3.5-flash-lite...');
        response = await ai.generate({
          model: googleAI.model('gemini-3.5-flash-lite', { temperature: 0.8 }),
          prompt,
          output: { schema: BragSchema },
        });
      } else {
        throw err;
      }
    }

    const output = response.output;

    // Verificação de output válido
    if (!output) {
      throw new Error('Falha ao gerar o Brag Document: a IA não retornou um output válido conforme o schema.');
    }

    // Retorno de todas as propriedades acrescidas do id nativo com uuidv4()
    return {
      ...output,
      id: uuidv4(),
    };
  }
);

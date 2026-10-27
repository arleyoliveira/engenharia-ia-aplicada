import {
  ai,
  BragInputSchema,
  BraginputSchema,
  BragSchema,
  BragOutputSchema,
  bragGeneratorFlow,
  BragOutput,
} from './flows';

describe('Genkit Flows - bragGeneratorFlow (Spec 03)', () => {
  describe('Configuração do Genkit (ai)', () => {
    it('deve ter a instância do Genkit inicializada', () => {
      expect(ai).toBeDefined();
    });

    it('deve ter o modelo padrão configurado com modelo Gemini e temperatura 0.8', () => {
      const defaultModel = ai.options.model as any;
      expect(defaultModel).toBeDefined();
      expect(defaultModel.name).toMatch(/gemini/);
      expect(defaultModel.config).toEqual({ temperature: 0.8 });
    });
  });

  describe('BragInputSchema', () => {
    it('deve validar um payload válido com definition', () => {
      const input = { definition: 'Criei um serviço de cache para queries no banco' };
      const parsed = BragInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.definition).toBe(input.definition);
      }
    });

    it('deve rejeitar se definition não for fornecido', () => {
      const parsed = BragInputSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });

    it('deve exportar BraginputSchema como alias idêntico', () => {
      expect(BraginputSchema).toBe(BragInputSchema);
    });

    it('deve conter .describe() no campo definition', () => {
      expect(BragInputSchema.shape.definition.description).toBeDefined();
      expect(BragInputSchema.shape.definition.description?.length).toBeGreaterThan(0);
    });
  });

  describe('BragSchema', () => {
    const validBrag = {
      title: 'Otimização de Pipeline de Dados com Gemini Flash',
      context: 'Pipeline legado sofria com alta latência em horários de pico.',
      actionTaken: 'Implementação de cache semântico e orquestração assíncrona.',
      businessImpact: 'Redução de 70% no tempo de processamento e economia de custos de infraestrutura.',
      metrics: ['70% reduction in processing time', 'Latência de 3s para 890ms'],
      technologiesUsed: ['Genkit', 'Gemini Flash', 'Node.js', 'TypeScript'],
    };

    it('deve validar um objeto estruturado de acordo com o BragSchema', () => {
      const parsed = BragSchema.safeParse(validBrag);
      expect(parsed.success).toBe(true);
    });

    it('deve conter describe() em todos os campos do BragSchema', () => {
      expect(BragSchema.shape.title.description).toBeDefined();
      expect(BragSchema.shape.context.description).toBeDefined();
      expect(BragSchema.shape.actionTaken.description).toBeDefined();
      expect(BragSchema.shape.businessImpact.description).toBeDefined();
      expect(BragSchema.shape.metrics.description).toBeDefined();
      expect(BragSchema.shape.technologiesUsed.description).toBeDefined();
    });

    it('deve exigir arrays para metrics e technologiesUsed', () => {
      const invalid = {
        ...validBrag,
        metrics: 'não é array',
      };
      const parsed = BragSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('BragOutputSchema', () => {
    it('deve conter o campo id em adição aos campos do BragSchema', () => {
      expect(BragOutputSchema.shape.id).toBeDefined();
      expect(BragOutputSchema.shape.id.description).toBeDefined();
      expect(BragOutputSchema.shape.title).toBeDefined();
    });
  });

  describe('bragGeneratorFlow', () => {
    it('deve ser um fluxo do Genkit registrado com nome bragGeneratorFlow', () => {
      expect(bragGeneratorFlow).toBeDefined();
      expect((bragGeneratorFlow as any).__action.name).toBe('bragGeneratorFlow');
    });

    it('deve ter BragInputSchema como inputSchema e BragSchema como outputSchema', () => {
      const action = (bragGeneratorFlow as any).__action;
      expect(action.inputSchema).toBe(BragInputSchema);
      expect(action.outputSchema).toBe(BragSchema);
    });

    it('deve executar o fluxo, chamar ai.generate com prompt estruturado e retornar dados acrescidos de uuidv4', async () => {
      const mockAiOutput = {
        title: 'Modernização de Microsserviços e Observabilidade',
        context: 'Sistemas legados apresentavam falhas intermitentes.',
        actionTaken: 'Refatoração da camada de mensageria e adição de tracing distribuído.',
        businessImpact: 'Aumento de 99.9% de SLA e estabilidade operacional.',
        metrics: ['SLA de 99.9%', '0 incidentes críticos em 60 dias'],
        technologiesUsed: ['TypeScript', 'Docker', 'OpenTelemetry'],
      };

      let capturedGenerateOptions: any = null;

      // Spy em ai.generate
      const originalGenerate = ai.generate;
      (ai as any).generate = async (opts: any) => {
        capturedGenerateOptions = opts;
        return {
          output: mockAiOutput,
        };
      };

      try {
        const input = {
          definition: 'Refatorei o serviço de mensageria da empresa e adicionei métricas de telemetria.',
        };

        const result = (await bragGeneratorFlow(input)) as unknown as BragOutput;

        // Valida parâmetros passados para ai.generate
        expect(capturedGenerateOptions).toBeDefined();
        expect(capturedGenerateOptions.output.schema).toBe(BragSchema);

        const promptText = capturedGenerateOptions.prompt;
        expect(promptText).toContain('Senior Career Consultant');
        expect(promptText).toContain('Planos de Desenvolvimento Individual (IDP)');
        expect(promptText).toContain('Brag Document');
        expect(promptText).toContain('Regra 1');
        expect(promptText).toContain('Regra 2');
        expect(promptText).toContain('Regra 3');
        expect(promptText).toContain('Regra 4');
        expect(promptText).toContain(input.definition);

        // Valida retorno final
        expect(result.title).toBe(mockAiOutput.title);
        expect(result.context).toBe(mockAiOutput.context);
        expect(result.actionTaken).toBe(mockAiOutput.actionTaken);
        expect(result.businessImpact).toBe(mockAiOutput.businessImpact);
        expect(result.metrics).toEqual(mockAiOutput.metrics);
        expect(result.technologiesUsed).toEqual(mockAiOutput.technologiesUsed);

        // Valida geração nativa do UUID v4
        expect(result.id).toBeDefined();
        expect(typeof result.id).toBe('string');
        const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(result.id).toMatch(uuidV4Regex);
      } finally {
        (ai as any).generate = originalGenerate;
      }
    });

    it('deve disparar erro quando a IA não retornar output válido', async () => {
      const originalGenerate = ai.generate;
      (ai as any).generate = async () => ({
        output: null,
      });

      try {
        await expect(
          bragGeneratorFlow({ definition: 'rascunho sem resposta' })
        ).rejects.toThrow('Falha ao gerar o Brag Document');
      } finally {
        (ai as any).generate = originalGenerate;
      }
    });
  });
});

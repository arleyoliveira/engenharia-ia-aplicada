export type ModelConfig = {
  apiKey: string;
  httpReferer: string;
  xTitle: string;

  provider: {
    sort: {
      by: string;
      partition: string;
    };
  };

  models: string[];
  temperature: number;

  memory: {
    dbUri: string;
  };
  
  maxMessageToSummary: number;
};

console.assert(process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY is not set in environment variables');

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpReferer: '',
  xTitle: 'Case IA Generativa para Recomendação de Músicas',
  models: [
    // 'qwen/qwen3-coder-next',
    // https://openrouter.ai/models?fmt=cards&max_price=0&order=throughput-high-to-low&supported_parameters=structured_outputs%2Cresponse_format
    //'upstage/solar-pro-3:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    //'google/gemma-4-26b-a4b-it:free' //Excedeu o limite
    //'cohere/rerank-4-pro', Não funcionou
    // 'gpt-oss-120b:free', Não funcionou
  ],
  provider: {
    sort: {
      by: 'throughput', // Route to model with highest throughput (fastest response)
      partition: 'none',
    },
  },
  temperature: 0.7,
  memory: {
    dbUri: 'postgresql://postgres:mysecretpassword@localhost:5432/song_recommender',
  },
  maxMessageToSummary: 6,
};

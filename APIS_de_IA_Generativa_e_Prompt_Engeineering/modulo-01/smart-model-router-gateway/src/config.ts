console.assert(
    process.env.OPENROUTER_API_KEY,
    'OPENROUTER_API_KEY is not set in env variables'
)

export type ModelConfig = {
    apiKey: string;
    httpReferer: string;
    xTitle: string;
    port: number;
    models: string[];
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    
    provider: {
        sort: {
            by: string,
            partitition: string
        }
    }
}

export const config: ModelConfig = {
    apiKey: process.env.OPENROUTER_API_KEY!,
    httpReferer: 'https://pos-ia.com',
    xTitle: 'SmartModelRouterGateway',
    port: 3000,
    models: [
        // top 4 para a listagem ordenada por preço
        //'arcee-ai/trinity-large-preview:free',
        
        // top 1 para a listagem ordenada por preço
        'nvidia/nemotron-3-ultra-550b-a55b-20260604:free',
        
        // top 3 para listagem de throughput
        'nvidia/nemotron-3-nano-30b-a3b:free'
    ],
    temperature: 0.2,
    maxTokens: 100,
    systemPrompt: 'You are a helpful assistant.',
    provider: {
        sort: {
            by: 'price',
            partitition: 'none'
        }
    }                              
}
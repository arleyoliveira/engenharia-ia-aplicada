import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../src/server.ts'
import { config } from '../src/config.ts'
import { type LLMResponse, OpenRouterService } from '../src/openRouterService.ts'

console.assert(
    process.env.OPENROUTER_API_KEY,
    'OPENROUTER_API_KEY is not set in env variables'
)

test.todo('routes to cheapes model by default', async () => {
    const customConfig = {
        ...config,
        provider: {
            ...config.provider,
            sort: {
                ...config.provider.sort,
                by: 'price'
            }
        }
    }
    const routerService = new OpenRouterService(customConfig)
    const app = createServer(routerService)

    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: 'Hello Word' }
    })

    assert.equal(response.statusCode, 200)
    const body = response.json() as LLMResponse
    assert.equal(body.model, "nvidia/nemotron-3-ultra-550b-a55b-20260604:free")
})

test.todo('routes to highest throughput model by default', async () => {
    const customConfig = {
        ...config,
        provider: {
            ...config.provider,
            sort: {
                ...config.provider.sort,
                by: 'throughput'
            }
        }
    }
    const routerService = new OpenRouterService(customConfig)
    const app = createServer(routerService)

    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: 'Hello Word' }
    })

    assert.equal(response.statusCode, 200)
    const body = response.json() as LLMResponse
    assert.equal(body.model, "nvidia/nemotron-3-ultra-550b-a55b-20260604:free")

    console.log('Response status', response.statusCode)
    console.log('Response body', response.body)
})
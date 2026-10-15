import { describe, it, after, before } from 'node:test'
import assert from 'node:assert'
import { Client } from '@modelcontextprotocol/sdk/client'
import { createTestClient } from '../helpers.ts'

describe('Customer Resources', () => {
    let client: Client
    before(async () => {
        client = await createTestClient()
    })

    after(async () => {
        await client.close()
    })

    it('should list the customers://api-info resource', async () => {
        const { resources } = await client.listResources()

        const info = resources.find((r) => r.uri === 'customers://api-info')
        assert.ok(info, 'Should find the customers://api-info resource')

        assert.deepStrictEqual(
            info.description, 
            'describe the customers rest API that this MCP server wraps',
            "description should match"
        )
    })
})

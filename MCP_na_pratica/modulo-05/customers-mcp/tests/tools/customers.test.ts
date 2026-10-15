import { describe, it, after, before } from 'node:test'
import assert from 'node:assert'
import { Client } from '@modelcontextprotocol/sdk/client'
import { createTestClient } from '../helpers.ts'
import { type CustomerMutation, type Customer, type CustomerUpdate } from '../../src/domain/customer.ts'

type CustomersResult = { structuredContent: { customers: Customer[] } }
type CustomerResult = { structuredContent: { customer: Customer } }
type CustomerMutationResult = { structuredContent: CustomerMutation }

describe('Customer MCP Suite', () => {
    let client: Client
    before(async () => {
        client = await createTestClient()
    })

    after(async () => {
        await client.close()
    })

    it('should list all customers', async () => {
        const result = await client.callTool({
            name: 'list_customers',
            arguments: {}
        }) as unknown as CustomersResult

        assert.ok(Array.isArray(
            result.structuredContent.customers),
            'Should return an array of customers'
        )
    })


    it('should create a customer', async () => {
        const customer = {
            name: 'Arley',
            phone: "38-991848038"
        }
        const result = await client.callTool({
            name: 'create_customer',
            arguments: customer
        }) as unknown as CustomerMutationResult

        assert.ok(result.structuredContent.id, 'Should return the id of the created customer')
        assert.deepStrictEqual(
            result.structuredContent.message,
            `user ${customer.name} created!`,
            'Should return a success message'
        )
    })

    it('should get a customer', async () => {
        const customer = {
            name: "Arley Oliveira",
            phone: "38-991848038"
        }

        const createResult = await client.callTool({
            name: 'create_customer',
            arguments: customer
        }) as unknown as CustomerMutationResult

        const result = await client.callTool({
            name: 'get_customer',
            arguments: {
                name: customer.name
            }
        }) as unknown as CustomerResult


        assert.ok(result.structuredContent.customer._id, 'Should return the id of the created customer')
        assert.deepStrictEqual(
            result.structuredContent.customer.name,
            customer.name,
            'Should return the correct customer name'
        )
    })

    it('should update a customer', async () => {

        const customer = {
            name: "Alonso Pereira",
            phone: "38991848038"
        }

        const { structuredContent: { id } } = await client.callTool({
            name: 'create_customer',
            arguments: customer
        }) as unknown as CustomerMutationResult


        const updateResult = await client.callTool({
            name: 'update_customer',
            arguments: {
                _id: id,
                name: "Joao de Lara",
                phone: "38998291884"
            } as CustomerUpdate
        }) as unknown as CustomerMutationResult


        assert.deepStrictEqual(id, updateResult.structuredContent.id)
        assert.deepStrictEqual(`User ${id} updated!`, updateResult.structuredContent.message)
    })

    it('should delete a customer', async () => {

        const customer = {
            name: "Alonso Pereira",
            phone: "38991848038"
        }

        const { structuredContent: { id } } = await client.callTool({
            name: 'create_customer',
            arguments: customer
        }) as unknown as CustomerMutationResult


        const deleteResult = await client.callTool({
            name: 'delete_customer',
            arguments: { _id: id }
        }) as unknown as CustomerMutationResult

        assert.deepStrictEqual(`User ${id} deleted!`, deleteResult.structuredContent.message)
        assert.ok(deleteResult.structuredContent.message, 'Should return the message of the delete customer')

    })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../src/server.ts'

test.todo('command upper transforms message into UPPERCASE', async () => {
    
    const app = createServer()

    const msg = 'make THis message UPPER please!'
    const expected = msg.toLocaleUpperCase()


    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: msg }
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.body, expected)
})

test.todo('command upper transforms message into LOWERCASE', async () => {
    
    const app = createServer()

    const msg = 'MAKE THIS MESSAGE LOWER PLEASE!'
    const expected = msg.toLocaleLowerCase()


    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: msg }
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.body, expected)
})

test.todo('command upper transforms message into UNKNOW', async () => {
    
    const app = createServer()

    const msg = 'HEY THERE!'
    const expected = "Unknow command. Try 'make this uppercase or 'convert to lowercase'"


    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: msg }
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.body, expected)
})
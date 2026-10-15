import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = 9999
const BASE = '/v1'

type Customer = { _id: string; name: string; phone: string }

let customers: Customer[] = [
  { _id: randomUUID(), name: 'Alice', phone: '11-99999-0001' },
  { _id: randomUUID(), name: 'Bob', phone: '11-99999-0002' },
]

function sendJson(res: http.ServerResponse, status: number, body: any) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(text)
  })
  res.end(text)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  if (!url.pathname.startsWith(BASE + '/customers')) {
    sendJson(res, 404, { message: 'Not found' })
    return
  }

  const id = url.pathname.split('/').pop()

  if (req.method === 'GET' && url.pathname === `${BASE}/customers`) {
    sendJson(res, 200, customers)
    return
  }

  if (req.method === 'GET' && id) {
    const found = customers.find(c => c._id === id)
    if (!found) return sendJson(res, 404, { message: 'Not found' })
    return sendJson(res, 200, found)
  }

  if (req.method === 'POST' && url.pathname === `${BASE}/customers`) {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const parsed = JSON.parse(body)
      const newCustomer: Customer = { _id: randomUUID(), name: parsed.name, phone: parsed.phone }
      customers.push(newCustomer)
      return sendJson(res, 201, { id: newCustomer._id, message: `user ${newCustomer.name} created!` })
    } catch (e) {
      return sendJson(res, 400, { message: 'invalid body' })
    }
  }

  if ((req.method === 'PUT' || req.method === 'DELETE') && id) {
    const idx = customers.findIndex(c => c._id === id)
    if (idx === -1) return sendJson(res, 404, { message: 'Not found' })

    if (req.method === 'PUT') {
      let body = ''
      for await (const chunk of req) body += chunk
      try {
        const parsed = JSON.parse(body)
        customers[idx] = { ...customers[idx], ...parsed }
        return sendJson(res, 200, { id, message: `User ${id} updated!` })
      } catch (e) {
        return sendJson(res, 400, { message: 'invalid body' })
      }
    }

    if (req.method === 'DELETE') {
      const removed = customers.splice(idx, 1)[0]
      return sendJson(res, 200, { id, message: `User ${id} deleted!` })
    }
  }

  sendJson(res, 405, { message: 'Method not allowed' })
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock REST server listening on http://localhost:${PORT}${BASE}`)
})

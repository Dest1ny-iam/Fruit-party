import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createApp } from './app.js'

const port = Number(process.env.PORT || 3000)
const databasePath = process.env.DATABASE_PATH || resolve(process.cwd(), 'data', 'fruit-party.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

const { app, close } = createApp({ databasePath, seed: true })
const server = app.listen(port, () => console.log(`Fruit Party API listening on http://127.0.0.1:${port}`))

function shutdown() {
  server.close(() => close())
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

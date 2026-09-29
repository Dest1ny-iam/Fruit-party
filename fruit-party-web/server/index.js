import 'dotenv/config'
import { createApp } from './app.js'

const port = Number(process.env.PORT || 3000)
const { app, close } = await createApp({ databaseName: process.env.MYSQL_DATABASE, seed: true })
const server = app.listen(port, () => console.log(`Fruit Party API listening on http://127.0.0.1:${port} with MySQL`))

function shutdown() {
  server.close(() => close())
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

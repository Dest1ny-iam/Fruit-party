export function createRealtimeHub() {
  const clients = new Map()

  function subscribe(userId, response) {
    const userClients = clients.get(userId) || new Set()
    userClients.add(response)
    clients.set(userId, userClients)
    return () => {
      userClients.delete(response)
      if (!userClients.size) clients.delete(userId)
    }
  }

  function publish(userId, event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const response of clients.get(userId) || []) response.write(payload)
  }

  function close() {
    for (const responses of clients.values()) for (const response of responses) response.end()
    clients.clear()
  }

  return { subscribe, publish, close }
}

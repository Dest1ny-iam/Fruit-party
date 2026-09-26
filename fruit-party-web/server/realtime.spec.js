import { describe, expect, it } from 'vitest'
import { createRealtimeHub } from './realtime.js'

describe('realtime hub', () => {
  it('delivers player state only to subscribers of the changed player', () => {
    const writes = []
    const response = { write: (message) => writes.push(message), end: () => {} }
    const hub = createRealtimeHub()
    hub.subscribe(7, response)

    hub.publish(7, 'player-state', { player: { username: 'tester' } })
    hub.publish(8, 'player-state', { player: { username: 'other' } })

    expect(writes).toEqual(['event: player-state\ndata: {"player":{"username":"tester"}}\n\n'])
  })
})

import { config, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import GameBoard from './GameBoard.vue'

config.stubs.ThreeFruitScene = true

const level = { number: 1, targetScore: 300 }

describe('GameBoard', () => {
  it('显示当前关卡、目标分和初始血量', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })

    expect(wrapper.text()).toContain('第 1 关')
    expect(wrapper.text()).toContain('目标 300')
    expect(wrapper.get('[data-test="health"]').text()).toContain('100')
  })

  it('退出确认弹层暂停本局，确认后按当前分数进入失败结算', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })

    await wrapper.get('[data-test="exit-game"]').trigger('click')

    expect(wrapper.get('[data-test="exit-confirmation"]').text()).toContain('确认退出本局')
    const timeAtPause = wrapper.vm.timeLeft
    const wavesAtPause = wrapper.vm.waveCount
    vi.advanceTimersByTime(3_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.timeLeft).toBe(timeAtPause)
    expect(wrapper.vm.waveCount).toBe(wavesAtPause)
    await wrapper.get('[data-test="cancel-exit"]').trigger('click')
    expect(wrapper.find('[data-test="exit-confirmation"]').exists()).toBe(false)

    wrapper.vm.score = 420
    await wrapper.get('[data-test="exit-game"]').trigger('click')
    await wrapper.get('[data-test="confirm-exit"]').trigger('click')

    expect(wrapper.emitted('finished')).toHaveLength(1)
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({ score: 420, completed: false, endReason: 'quit' })
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('按住游戏区域时进入切割状态，松开后结束', async () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    const board = wrapper.get('[data-test="game-board"]')

    expect(wrapper.vm.isSlicing).toBe(false)
    await board.trigger('mousedown')
    expect(wrapper.vm.isSlicing).toBe(true)
    expect(board.classes()).toContain('is-slicing')

    await board.trigger('mouseup')
    expect(wrapper.vm.isSlicing).toBe(false)
  })

  it('定时生成一波多个水果，并覆盖不同的甩入方向', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })

    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-test="fruit"]')).toHaveLength(4)
    expect(wrapper.vm.fruits.map((fruit) => fruit.origin)).toEqual(['left', 'bottom', 'right', 'top'])
    vi.useRealTimers()
  })

  it('进入游戏后立即生成第一波水果，避免初始画面空白', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })

    expect(wrapper.vm.fruits).toHaveLength(2)
    expect(wrapper.vm.fruits.map((fruit) => fruit.emoji)).toEqual(['🍉', '🍈'])
  })

  it('首关时限为 30 秒，后续最多 50 秒，并可被延时道具增加 10 秒', () => {
    const firstLevel = mount(GameBoard, { propsData: { level } })
    const laterLevel = mount(GameBoard, { propsData: { level: { number: 5, targetScore: 1600 } } })
    const extendedLevel = mount(GameBoard, { propsData: { level, activeItems: ['time-plus'] } })

    expect(firstLevel.vm.roundSeconds).toBe(30)
    expect(firstLevel.vm.timeLeft).toBe(30)
    expect(firstLevel.get('[data-test="time-left"]').text()).toContain('30s')
    expect(laterLevel.vm.roundSeconds).toBe(50)
    expect(extendedLevel.vm.roundSeconds).toBe(40)
    firstLevel.destroy()
    laterLevel.destroy()
    extendedLevel.destroy()
  })

  it('复活进入游戏时保留分数和剩余时间，但将当前连击清零', () => {
    const wrapper = mount(GameBoard, {
      propsData: { level, initialRound: { score: 240, health: 50, timeLeft: 31, slicedCount: 17, appearedCount: 20, bestCombo: 6 } },
    })

    expect(wrapper.vm.score).toBe(240)
    expect(wrapper.vm.health).toBe(50)
    expect(wrapper.vm.timeLeft).toBe(31)
    expect(wrapper.vm.currentCombo).toBe(0)
    expect(wrapper.vm.bestCombo).toBe(6)
  })

  it('无尽主动分数卡只在激活后的 20 秒提升新得分', () => {
    const wrapper = mount(GameBoard, {
      propsData: { level: { number: 0, targetScore: 0 }, mode: 'endless', activeItems: ['score-boost'] },
    })
    wrapper.vm.fruits = [{ id: 91, type: 'apple', emoji: '🍎', origin: 'bottom' }]
    wrapper.vm.handleFruitSliced({ id: 91, type: 'apple' })
    expect(wrapper.vm.score).toBe(15)

    wrapper.vm.activateEndlessItem('score-boost')
    wrapper.vm.fruits = [{ id: 92, type: 'apple', emoji: '🍎', origin: 'bottom' }]
    wrapper.vm.currentCombo = 0
    wrapper.vm.handleFruitSliced({ id: 92, type: 'apple' })

    expect(wrapper.vm.score).toBe(33)
    expect(wrapper.vm.activeItemSeconds['score-boost']).toBe(20)
    wrapper.destroy()
  })

  it('无尽模式从零正向计时，并将累计时间交给结算流程', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, {
      propsData: { level: { number: 0, targetScore: 0 }, mode: 'endless' },
    })

    expect(wrapper.get('[data-test="time-left"]').text()).toContain('00:00')
    vi.advanceTimersByTime(3_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-test="time-left"]').text()).toContain('00:03')

    wrapper.vm.finishGame(false, 'bomb')
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({ elapsedSeconds: 3 })
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('无尽模式退出确认与结束遮罩不使用失败文案', async () => {
    const wrapper = mount(GameBoard, {
      propsData: { level: { number: 0, targetScore: 0 }, mode: 'endless' },
    })

    await wrapper.get('[data-test="exit-game"]').trigger('click')
    expect(wrapper.get('[data-test="exit-confirmation"]').text()).toContain('按当前成绩直接结算')
    expect(wrapper.get('[data-test="exit-confirmation"]').text()).not.toContain('失败结算')

    await wrapper.get('[data-test="confirm-exit"]').trigger('click')
    expect(wrapper.get('[data-test="game-over"]').text()).toContain('本局结算')
    expect(wrapper.get('[data-test="game-over"]').text()).not.toContain('挑战失败')
  })

  it('无尽炸弹卡激活时每三个炸弹候选只保留一个', () => {
    const wrapper = mount(GameBoard, {
      propsData: { level: { number: 0, targetScore: 0 }, mode: 'endless', activeItems: ['bomb-shield'] },
    })
    wrapper.vm.activateEndlessItem('bomb-shield')

    expect([1, 2, 3, 4, 5, 6].map(() => wrapper.vm.shouldSpawnBombCandidate())).toEqual([true, false, false, true, false, false])
    wrapper.destroy()
  })

  it('无尽复活恢复原波次、下个水果编号和主动道具状态', () => {
    const wrapper = mount(GameBoard, {
      propsData: {
        level: { number: 0, targetScore: 0 },
        mode: 'endless',
        activeItems: ['bomb-shield', 'score-boost'],
        initialRound: {
          score: 500, waveCount: 24, nextFruitId: 87, bombCandidateCount: 6,
          usedActiveItems: ['score-boost'], activeItemSeconds: { 'score-boost': 11, 'bomb-shield': 0 },
          slicedCount: 20, appearedCount: 28, bestCombo: 9,
        },
      },
    })

    expect(wrapper.vm.waveCount).toBe(25)
    expect(wrapper.vm.nextFruitId).toBeGreaterThan(87)
    expect(wrapper.vm.usedActiveItems).toContain('score-boost')
    expect(wrapper.vm.activeItemSeconds['score-boost']).toBe(11)
    expect(wrapper.vm.difficulty.speedMultiplier).toBeGreaterThan(1)
    wrapper.destroy()
  })

  it('在 3D 场景确认可用前保留普通水果降级层', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })

    expect(wrapper.vm.threeSupported).toBe(false)
    expect(wrapper.get('.three-unavailable').exists()).toBe(true)
  })

  it('普通模式前几波优先出现大中型水果，降低新手关卡难度', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })
    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()

    const earlyTypes = wrapper.vm.fruits.filter((item) => item.type !== 'bomb').map((item) => item.type)
    expect(earlyTypes).toContain('watermelon')
    expect(earlyTypes).toContain('cantaloupe')
    expect(earlyTypes).not.toContain('kiwi')
    expect(earlyTypes).not.toContain('strawberry')
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('普通模式前五关限制场上水果数量，避免多个波次堆叠成一团', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })

    vi.advanceTimersByTime(7000)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.fruits).toHaveLength(6)
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('同屏上限淘汰未切水果时按漏切处理并清空当前连击', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.spawnWave()
    wrapper.vm.spawnWave()
    wrapper.vm.currentCombo = 4

    wrapper.vm.spawnWave()

    expect(wrapper.vm.fruits).toHaveLength(6)
    expect(wrapper.vm.currentCombo).toBe(0)
    wrapper.destroy()
  })

  it('切中水果后按种类加分并移除水果', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.fruits = [{ id: 99, type: 'pineapple', emoji: '🍍', origin: 'left' }]
    wrapper.vm.handleFruitSliced({ id: 99, type: 'pineapple' })

    expect(wrapper.vm.score).toBe(12)
    expect(wrapper.vm.fruits).toHaveLength(0)
  })

  it('结束对局时保留每颗切中水果的类型，供服务端按真实规则结算', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.fruits = [{ id: 99, type: 'apple', emoji: '🍎', origin: 'left' }]

    wrapper.vm.handleFruitSliced({ id: 99, type: 'apple' })
    wrapper.vm.finishGame(false, 'quit')

    expect(wrapper.emitted('finished')[0][0]).toMatchObject({ fruitHits: [{ fruit: 'apple' }], roundSeconds: 30 })
    wrapper.destroy()
  })

  it('致命伤害时有复活卡先显示复活选择，不立即结算', async () => {
    const wrapper = mount(GameBoard, { propsData: { level, reviveCount: 1 } })

    ;[91, 92, 93, 94].forEach((id) => wrapper.vm.handleBombHit({ id }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('finished')).toBeUndefined()
    expect(wrapper.get('[data-test="revive-prompt"]').text()).toContain('使用复活卡')
    await wrapper.get('[data-test="request-revive"]').trigger('click')
    expect(wrapper.emitted('revive-requested')).toHaveLength(1)
  })

  it('复活成功后保留分数和波次，恢复血量并继续当前难度', () => {
    const wrapper = mount(GameBoard, { propsData: { level: { number: 0, targetScore: 0 }, mode: 'endless', reviveCount: 3 } })
    wrapper.vm.score = 860
    wrapper.vm.waveCount = 25
    wrapper.vm.health = 0
    wrapper.vm.pendingEndReason = 'bomb'
    wrapper.vm.revivePromptOpen = true

    wrapper.vm.resumeAfterRevive()

    expect(wrapper.vm.score).toBe(860)
    expect(wrapper.vm.waveCount).toBe(25)
    expect(wrapper.vm.health).toBe(50)
    expect(wrapper.vm.reviveUses).toBe(1)
    expect(wrapper.vm.revivePromptOpen).toBe(false)
    expect(wrapper.vm.difficulty.speedMultiplier).toBeGreaterThan(1)
    wrapper.destroy()
  })

  it('同一个水果重复触发切中事件时只结算一次分数', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.fruits = [{ id: 99, type: 'pineapple', emoji: '🍍', origin: 'bottom' }]

    wrapper.vm.handleFruitSliced({ id: 99, type: 'pineapple' })
    wrapper.vm.handleFruitSliced({ id: 99, type: 'pineapple' })

    expect(wrapper.vm.score).toBe(12)
    expect(wrapper.vm.slicedCount).toBe(1)
    expect(wrapper.vm.currentCombo).toBe(1)
  })

  it('连续切中水果会累计连击并提高后续得分', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00'))
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.fruits = [
      { id: 99, type: 'apple', emoji: '🍎', origin: 'left' },
      { id: 100, type: 'apple', emoji: '🍎', origin: 'right' },
    ]

    wrapper.vm.handleFruitSliced({ id: 99, type: 'apple' })
    vi.advanceTimersByTime(500)
    wrapper.vm.handleFruitSliced({ id: 100, type: 'apple' })

    expect(wrapper.vm.currentCombo).toBe(2)
    expect(wrapper.vm.bestCombo).toBe(2)
    expect(wrapper.vm.score).toBe(32)
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('普通模式第一关第七波才加入炸弹，切中后扣除血量', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })
    vi.advanceTimersByTime(6000)
    await wrapper.vm.$nextTick()
    const bomb = wrapper.vm.fruits.find((item) => item.type === 'bomb')

    expect(bomb).toBeTruthy()
    wrapper.vm.handleBombHit({ id: bomb.id })
    expect(wrapper.vm.health).toBe(75)
    expect(wrapper.vm.fruits.some((item) => item.id === bomb.id)).toBe(false)
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('切中炸弹额外扣除 2 秒，但未归零时继续游戏', () => {
    const wrapper = mount(GameBoard, {
      propsData: { level, initialRound: { timeLeft: 20 } },
    })
    wrapper.vm.fruits = [{ id: 99, type: 'bomb', emoji: '💣', origin: 'bottom' }]

    wrapper.vm.handleBombHit({ id: 99 })

    expect(wrapper.vm.health).toBe(75)
    expect(wrapper.vm.timeLeft).toBe(18)
    expect(wrapper.emitted('finished')).toBeUndefined()
    wrapper.destroy()
  })

  it('炸弹扣时导致时间归零时立即判定超时失败', () => {
    const wrapper = mount(GameBoard, {
      propsData: { level, initialRound: { timeLeft: 1 } },
    })
    wrapper.vm.fruits = [{ id: 99, type: 'bomb', emoji: '💣', origin: 'bottom' }]

    wrapper.vm.handleBombHit({ id: 99 })

    expect(wrapper.vm.timeLeft).toBe(0)
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({ completed: false, endReason: 'timeout' })
    wrapper.destroy()
  })

  it('血量归零后停止生成水果并显示本局结束', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })
    const bombIds = [91, 92, 93, 94]

    bombIds.forEach((id) => wrapper.vm.handleBombHit({ id }))
    const waveCountAtGameOver = wrapper.vm.waveCount
    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.health).toBe(0)
    expect(wrapper.vm.waveCount).toBe(waveCountAtGameOver)
    expect(wrapper.vm.fruits).toHaveLength(0)
    expect(wrapper.get('[data-test="game-over"]').text()).toContain('挑战失败')
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('达到目标分后继续计时，固定时限到达后才判定通关', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.score = 290
    wrapper.vm.timeLeft = 1
    wrapper.vm.fruits = [{ id: 99, type: 'apple', emoji: '🍎', origin: 'bottom' }]

    wrapper.vm.handleFruitSliced({ id: 99, type: 'apple' })
    expect(wrapper.emitted('finished')).toBeUndefined()
    expect(wrapper.vm.targetReached).toBe(true)

    wrapper.vm.tickGameClock()

    expect(wrapper.emitted('finished')).toHaveLength(1)
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({
      score: 305,
      healthLeft: 100,
      completed: true,
      endReason: 'timeout',
    })
    wrapper.destroy()
  })

  it('达到目标分后被炸弹击败仍判定失败', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.score = 290
    wrapper.vm.fruits = [{ id: 99, type: 'apple', emoji: '🍎', origin: 'bottom' }]

    wrapper.vm.handleFruitSliced({ id: 99, type: 'apple' })
    ;[91, 92, 93, 94].forEach((id) => wrapper.vm.handleBombHit({ id }))

    expect(wrapper.emitted('finished')).toHaveLength(1)
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({
      score: 305,
      completed: false,
      endReason: 'bomb',
    })
    wrapper.destroy()
  })

  it('固定时限结束仍未达到目标分时判定失败', async () => {
    vi.useFakeTimers()
    const wrapper = mount(GameBoard, { propsData: { level } })

    vi.advanceTimersByTime(wrapper.vm.roundSeconds * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('finished')[0][0]).toMatchObject({
      score: 0,
      completed: false,
      endReason: 'timeout',
    })
    expect(wrapper.get('[data-test="game-over"]').text()).toContain('挑战失败')
    wrapper.destroy()
    vi.useRealTimers()
  })

  it('本局结束时只发送一次包含结算统计的 finished 事件', () => {
    const wrapper = mount(GameBoard, { propsData: { level } })
    wrapper.vm.score = 320
    wrapper.vm.slicedCount = 24
    wrapper.vm.appearedCount = 26
    wrapper.vm.bestCombo = 8

    ;[91, 92, 93, 94].forEach((id) => wrapper.vm.handleBombHit({ id }))

    expect(wrapper.emitted('finished')).toHaveLength(1)
    expect(wrapper.emitted('finished')[0][0]).toMatchObject({
      mode: 'normal',
      level: 1,
      score: 320,
      targetScore: 300,
      slicedCount: 24,
      appearedCount: 26,
      bestCombo: 8,
      healthLeft: 0,
      completed: false,
    })
  })
})

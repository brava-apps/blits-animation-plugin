import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import symbols from '@lightningjs/blits/symbols'
import animation from '../src/index.js'

function setup() {
  const renderer = new EventEmitter()
  const api = animation.plugin()
  api.init(renderer)
  return { api, renderer, tick: (time) => renderer.emit('frameTick', { time }) }
}
function element() {
  return {
    node: { x: 0, color: 0xff0000ff }, writes: [],
    set(prop, value) { this.writes.push([prop, value]); this.node[prop] = value },
  }
}
// Narrow structural inspection of existing private symbols; no production debug API.
function privateValue(object, description) {
  return object[Object.getOwnPropertySymbols(object).find((key) => key.description === description)]
}

test('initialization failures reject without group membership', async () => {
  const api = animation.plugin()
  const group = api.group()
  const controller = group.animate(element(), { x: 10 })
  await assert.rejects(controller, /not initialized/)
  assert.equal(controller.outcome, null)
  assert.equal(privateValue(group, 'group').jobs.size, 0)
  controller.dispose().reset().cancel().pause().resume()
  assert.equal(group.dispose(), group)
})

test('all group factories preserve values, colors, target arrays and holder normalization', async () => {
  const { api, tick } = setup()
  const group = api.group()
  const a = element(), b = element(), c = element()
  const component = { $componentId: 'card', [symbols.holder]: b }
  const controllers = [
    group.animate([a, component], { x: 10, color: '#00f' }, { duration: 100, easing: 'linear' }),
    group.sequence([{ element: c, prop: 'color', value: '#fff', duration: 100 }]),
    group.timeline([{ element: component, prop: 'x', value: 20, at: 0.5, duration: 0.5 }], 200),
  ]
  assert.equal(privateValue(group, 'group').jobs.size, 3)
  tick(0); tick(100); tick(200)
  assert.deepEqual(await Promise.all(controllers), [undefined, undefined, undefined])
  assert.equal(a.node.x, 10)
  assert.equal(a.node.color, 0x0000ffff)
  assert.equal(b.node.x, 20)
  assert.equal(c.node.color, 0xffffffff)
  assert.equal(privateValue(group, 'group').jobs.size, 0)
  for (const controller of controllers) assert.equal(controller.outcome, 'completed')
})

test('group disposal settles running, delayed and paused work without writes or callbacks', async () => {
  const { api, renderer, tick } = setup()
  const group = api.group()
  const targets = [element(), element(), element()]
  let callbacks = 0
  const controllers = targets.map((target, index) => group.sequence([
    { element: target, prop: 'x', value: 100, duration: 100, delay: index === 1 ? 200 : 0,
      onEnd: () => callbacks++ },
  ]))
  tick(0); tick(25)
  controllers[2].pause()
  const writes = targets.map((target) => target.writes.length)
  const jobs = controllers.map((controller) => privateValue(controller, 'job'))
  const segments = jobs.flatMap((job) => job.segments)
  assert.equal(group.dispose(), group)
  group.dispose().cancel()
  assert.deepEqual(await Promise.all(controllers), [undefined, undefined, undefined])
  for (const controller of controllers) {
    assert.equal(controller.outcome, 'disposed')
    assert.equal(controller.dispose().reset().pause().resume().cancel(), controller)
    assert.equal(privateValue(controller, 'job'), undefined)
  }
  for (const job of jobs) {
    assert.deepEqual(job.segments, [])
    assert.deepEqual(job.activeSegments, [])
    assert.equal(job.controller, null)
    assert.equal(job.resolve, null)
    assert.equal(job.groupState, null)
  }
  for (const segment of segments) {
    assert.equal(segment.element, null)
    assert.equal(segment.onEnd, null)
    assert.equal(segment.easingFunction, null)
  }
  tick(1000)
  assert.deepEqual(targets.map((target) => target.writes.length), writes)
  assert.equal(callbacks, 0)
  assert.equal(renderer.listenerCount('frameTick'), 1)
  assert.equal(privateValue(group, 'group').jobs.size, 0)
})

test('cancel preserves current values and reset data while leaving group reusable', async () => {
  const { api, tick } = setup()
  const group = api.group(), target = element()
  const controller = group.animate(target, { x: 100 }, { duration: 100, easing: 'linear' })
  tick(0); tick(50)
  assert.equal(group.cancel(), group)
  assert.equal(await controller, undefined)
  assert.equal(target.node.x, 50)
  assert.equal(controller.outcome, 'cancelled')
  controller.reset()
  assert.equal(target.node.x, 0)
  const next = group.animate(target, { x: 10 }, { duration: 0 })
  tick(100)
  await next
  assert.equal(next.outcome, 'completed')
  group.dispose()
})

test('disposed factories reject before accessing arguments and other jobs continue', async () => {
  const { api, tick } = setup()
  const group = api.group().dispose()
  const poison = new Proxy({}, { get() { assert.fail('argument accessed') }, ownKeys() { assert.fail('argument accessed') } })
  assert.throws(() => group.animate(poison, poison, poison), /group is disposed/)
  assert.throws(() => group.sequence(poison), /group is disposed/)
  assert.throws(() => group.timeline(poison), /group is disposed/)
  const other = api.group(), a = element(), b = element()
  const controllers = [other.animate(a, { x: 1 }, { duration: 0 }), api.animate(b, { x: 2 }, { duration: 0 })]
  tick(0)
  await Promise.all(controllers)
  assert.equal(a.node.x, 1); assert.equal(b.node.x, 2)
  other.dispose()
})

test('outcomes record first settlement, empty completion and undefined await values', async () => {
  const { api, tick } = setup()
  for (const action of ['cancel', 'reset', 'dispose']) {
    const controller = api.animate(element(), { x: 10 })
    assert.equal(controller.outcome, null)
    controller[action]()
    assert.equal(await controller, undefined)
    assert.equal(controller.outcome, action === 'cancel' ? 'cancelled' : action === 'dispose' ? 'disposed' : 'reset')
    const first = controller.outcome
    controller.cancel().reset().dispose()
    assert.equal(controller.outcome, first)
  }
  const group = api.group()
  for (const controller of [group.animate([], {}), group.sequence([]), group.timeline([])]) {
    assert.equal(controller.outcome, 'completed')
    assert.equal(await controller, undefined)
    controller.reset().dispose()
    assert.equal(controller.outcome, 'completed')
    assert.throws(() => { controller.outcome = 'disposed' }, TypeError)
  }
  const target = element(), controller = group.animate(target, { x: 10 }, { duration: 0 })
  tick(0); await controller
  group.dispose()
  controller.reset()
  assert.equal(target.node.x, 0)
  target.node.x = 7
  controller.dispose().reset()
  assert.equal(target.node.x, 7)
  assert.equal(controller.outcome, 'completed')
})

test('cancelled settled controllers remain resettable after their former group is disposed', async () => {
  const { api, tick } = setup()
  const group = api.group(), target = element()
  const controller = group.animate(target, { x: 10 }, { duration: 100, easing: 'linear' })
  tick(0); tick(50)
  controller.cancel(); await controller
  group.dispose()
  controller.reset()
  assert.equal(target.node.x, 0)
  controller.dispose()
  assert.equal(controller.outcome, 'cancelled')
})

test('callback cancellation/disposal prevents remaining tracks and callbacks in the same tick', async () => {
  for (const action of ['cancel', 'dispose']) {
    for (const scope of ['controller', 'group']) {
      const { api, tick } = setup()
      const group = api.group(), target = element(), otherTarget = element()
      let controller, laterCallbacks = 0
      controller = group.timeline([
        { element: target, prop: 'x', value: 10, at: 0, duration: 0,
          onEnd() { (scope === 'group' ? group : controller)[action]() } },
        { element: target, prop: 'color', value: '#fff', at: 0, duration: 0,
          onEnd() { laterCallbacks++ } },
      ])
      const other = group.animate(otherTarget, { x: 20 }, { duration: 0 })
      tick(0)
      await Promise.all([controller, other])
      assert.equal(target.node.x, 10)
      assert.equal(target.node.color, 0xff0000ff)
      assert.equal(laterCallbacks, 0)
      assert.equal(otherTarget.node.x, scope === 'group' ? 0 : 20)
      assert.equal(controller.outcome, action === 'cancel' ? 'cancelled' : 'disposed')
      group.dispose()
    }
  }
})

test('repeated pause/dispose cycles remove pending ownership and scheduling', async () => {
  const { api, tick } = setup()
  const target = element()
  for (let index = 0; index < 100; index++) {
    const group = api.group()
    const controller = group.animate(target, { x: index + 1 })
    controller.pause()
    group.dispose()
    await controller
    assert.equal(privateValue(group, 'group').jobs.size, 0)
  }
  tick(0); tick(10000)
  assert.equal(target.writes.length, 0)
})

test('real headless Blits component disposes its group before target teardown', async () => {
  const { default: Component } = await import('../node_modules/@lightningjs/blits/src/component.js')
  const { default: renderComponent } = await import('../node_modules/@lightningjs/blits/src/testing/renderComponent.js')
  const { api, tick } = setup()
  let controller, target, group
  const Card = Component('CleanupTestCard', {
    template: '<Element ref="card" w="200" h="100" color="#fff" />',
    hooks: {
      init() { this.animations = api.group(); group = this.animations },
      ready() {
        // The headless Element fixture stores ref in attributes, not element.ref.
        target = this[symbols.wrapper]
        controller = this.animations.animate(target, { alpha: { from: 0, to: 1 } }, { duration: 200 })
      },
      destroy() {
        assert.equal(this.eol, true)
        assert.notEqual(target.eol, true)
        this.animations.dispose()
        assert.equal(controller.outcome, 'disposed')
        this.animations = null
      },
    },
  })
  const fixture = renderComponent(Card)
  try {
    await new Promise((resolve) => setTimeout(resolve, 0))
    tick(0)
    controller.pause()
    fixture.destroy()
    assert.equal(await controller, undefined)
    assert.equal(target.eol, true)
    assert.equal(privateValue(group, 'group').jobs.size, 0)
    assert.equal(privateValue(controller, 'job'), undefined)
    tick(500)
  } finally {
    fixture.destroy()
  }
})


test('custom easing can cancel or dispose without later writes or callbacks', async () => {
  for (const prop of ['x', 'color']) {
    for (const action of ['cancel', 'dispose']) {
      const { api, tick } = setup()
      const group = api.group(), target = element()
      let controller, callbacks = 0
      controller = group.sequence([{
        element: target, prop, value: prop === 'x' ? 100 : '#fff', duration: 100,
        easing(progress) { group[action](); return progress },
        onEnd() { callbacks++ },
      }])
      assert.doesNotThrow(() => tick(0))
      assert.equal(await controller, undefined)
      assert.equal(controller.outcome, action === 'cancel' ? 'cancelled' : 'disposed')
      tick(100)
      assert.equal(target.writes.length, 0)
      assert.equal(callbacks, 0)
      group.dispose()
    }
  }
})

test('group disposal during compilation or reset capture prevents scheduling', () => {
  const { api, tick } = setup()
  for (const stage of ['properties', 'reset']) {
    const group = api.group(), target = element()
    let properties = { x: 100 }
    if (stage === 'properties') {
      properties = { get x() { group.dispose(); return 100 } }
    } else {
      Object.defineProperty(target.node, 'x', { get() { group.dispose(); return 0 } })
    }
    assert.throws(() => group.animate(target, properties), /group is disposed/)
    assert.equal(privateValue(group, 'group').jobs.size, 0)
    tick(0); tick(1000)
    assert.equal(target.writes.length, 0)
  }
})

test('settlement releases callbacks and custom easing while preserving reset', async () => {
  for (const action of ['completed', 'cancel', 'reset']) {
    const { api, tick } = setup()
    const target = element()
    const controller = api.sequence([{
      element: target, prop: 'x', value: 100, duration: 100,
      easing: (t) => t, onEnd() {},
    }])
    const job = privateValue(controller, 'job')
    if (action === 'completed') { tick(0); tick(100) }
    else controller[action]()
    await controller
    for (const segment of job.segments) {
      assert.equal(segment.onEnd, null)
      assert.equal(segment.easing, null)
      assert.equal(segment.easingFunction, null)
      assert.equal(segment.element, target)
    }
    controller.reset()
    assert.equal(target.node.x, 0)
    controller.dispose()
  }
})

test('group pause preserves individual pauses and resume timing', async () => {
  const { api, tick } = setup()
  const group = api.group(), a = element(), b = element()
  const first = group.animate(a, { x: 100 }, { duration: 100, easing: 'linear' })
  const second = group.animate(b, { x: 100 }, { duration: 100, easing: 'linear' })
  tick(0); tick(25)
  second.pause()
  assert.equal(group.pause().pause(), group)
  tick(100)
  assert.equal(a.node.x, 25); assert.equal(b.node.x, 25)
  first.pause() // Individual pause added while the group is paused.
  assert.equal(group.resume().resume(), group)
  tick(125)
  assert.equal(a.node.x, 25); assert.equal(b.node.x, 25)
  first.resume()
  tick(150); tick(175)
  assert.equal(a.node.x, 50); assert.equal(b.node.x, 25)
  second.resume()
  tick(200); tick(275)
  await Promise.all([first, second])
  assert.equal(a.node.x, 100); assert.equal(b.node.x, 100)
  group.dispose().pause().resume()
})

test('new and delayed jobs wait for group resume; cancel cannot be resumed', async () => {
  const { api, tick } = setup()
  const group = api.group().pause(), target = element()
  const controller = group.animate(target, { x: 100 }, { delay: 50, duration: 100, easing: 'linear' })
  controller.pause().resume() // Cannot override the group pause.
  tick(0); tick(100)
  assert.equal(target.writes.length, 0)
  assert.equal(controller.outcome, null)
  group.resume()
  tick(200); tick(225)
  group.pause()
  tick(500)
  group.resume(); tick(600); tick(625)
  assert.equal(target.node.x, 0)
  tick(650)
  assert.equal(target.node.x, 25)
  group.cancel().resume()
  await controller
  const writes = target.writes.length
  tick(1000)
  assert.equal(target.writes.length, writes)
  assert.equal(controller.outcome, 'cancelled')
  group.dispose()
})

test('group pause from a callback stops other tracks and owned jobs in that frame', async () => {
  const { api, tick } = setup()
  const group = api.group(), a = element(), b = element()
  const first = group.timeline([
    { element: a, prop: 'x', value: 10, at: 0, duration: 0, onEnd() { group.pause() } },
    { element: a, prop: 'color', value: '#fff', at: 0, duration: 0 },
  ])
  const second = group.animate(b, { x: 20 }, { duration: 0 })
  tick(0)
  assert.equal(a.node.color, 0xff0000ff)
  assert.equal(b.node.x, 0)
  group.resume(); tick(100)
  await Promise.all([first, second])
  assert.equal(a.node.color, 0xffffffff)
  assert.equal(b.node.x, 20)
  group.dispose()
})

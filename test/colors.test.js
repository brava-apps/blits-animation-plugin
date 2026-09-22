import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import animation from '../src/index.js'
import { CoreNode, CoreTextNode } from '@lightningjs/renderer'
import createElement from '../node_modules/@lightningjs/blits/src/engines/L3/element.js'

function setup(color = '0xff0000ff') {
  const renderer = new EventEmitter()
  const api = animation.plugin()
  api.init(renderer)
  const element = createElement({ parent: {} }, {})
  element.props.raw = { color }
  element.node = { color, x: 0 }
  return { api, element, tick: (time) => renderer.emit('frameTick', { time }) }
}

test('interpolates RGBA alongside numbers and permits subsequent Blits updates', async () => {
  const { api, element, tick } = setup()
  const controller = api.animate(element, { color: '#0000ff00', x: 100 }, {
    duration: 100, easing: 'linear',
  })
  tick(0)
  tick(50)
  assert.equal(element.node.color, 0x80008080)
  assert.equal(element.node.x, 50)
  tick(100)
  await controller
  assert.equal(element.node.color, 0x0000ff00)
  element.set('color', '0xff0000ff')
  assert.equal(Number(element.node.color), 0xff0000ff)
  controller.reset()
  assert.equal(element.node.color, 0xff0000ff)
})

test('accepts supported formats, explicit from, equal endpoints and zero duration', async () => {
  for (const to of ['#0f0', '#00ff00', '#00ff00ff', '0x00ff00ff', 0x00ff00ff, 'lime']) {
    const { api, element, tick } = setup()
    const controller = api.animate(element, { color: { from: '#0f0', to } })
    tick(0)
    await controller
    assert.equal(element.node.color, 0x00ff00ff)
  }
  const { api, element, tick } = setup()
  const controller = api.animate(element, { color: 0 }, { duration: 0 })
  tick(0)
  await controller
  assert.equal(element.node.color, 0)
})

test('reads delayed starts and supports pause, resume, cancellation and reset', async () => {
  const { api, element, tick } = setup()
  const controller = api.animate(element, { color: '#fff' }, {
    delay: 20, duration: 100, easing: 'linear',
  })
  tick(0)
  element.set('color', '#000')
  tick(20)
  tick(70)
  assert.equal(element.node.color, 0x808080ff)
  controller.pause()
  tick(90)
  assert.equal(element.node.color, 0x808080ff)
  controller.resume()
  tick(100)
  assert.equal(element.node.color, 0x808080ff)
  tick(125)
  assert.equal(element.node.color, 0xbfbfbfff)
  controller.cancel()
  await controller
  tick(200)
  assert.equal(element.node.color, 0xbfbfbfff)
  controller.reset()
  assert.equal(element.node.color, 0xff0000ff)
})

test('sequence and timeline capture the previous color at each step', async () => {
  for (const method of ['sequence', 'timeline']) {
    const { api, element, tick } = setup('0x000000ff')
    const steps = [
      { element, prop: 'color', value: '#fff', duration: 100, easing: 'linear' },
      { element, prop: 'color', value: '#000', duration: 100, easing: 'linear' },
    ]
    if (method === 'timeline') {
      steps[0].at = 0
      steps[1].at = 0.5
      steps[0].duration = steps[1].duration = 0.5
    }
    const controller = api[method](steps, 200)
    tick(0)
    tick(100)
    assert.equal(element.node.color, 0xffffffff)
    tick(150)
    assert.equal(element.node.color, 0x808080ff)
    tick(200)
    await controller
    assert.equal(element.node.color, 0x000000ff)
    controller.reset()
    assert.equal(element.node.color, 0x000000ff)
  }
})

test('clamps color easing overshoot and rejects unsupported endpoints before scheduling', () => {
  for (const eased of [-0.5, 1.5]) {
    const { api, element, tick } = setup()
    const controller = api.animate(element, { color: '#00f' }, {
      duration: 100, easing: () => eased,
    })
    tick(0)
    tick(50)
    assert.equal(element.node.color, eased < 0 ? 0xff0000ff : 0x0000ffff)
    controller.cancel()
  }
  const { api, element } = setup()
  for (const color of ['unknown-color', 'constructor', 'toString', '#12345', -1, 0x100000000, NaN, { top: '#fff' }]) {
    assert.throws(() => api.animate(element, { color }), /Invalid color/)
  }
})


test('named colors use the Blits numeric fast path for regular and text nodes', async () => {
  for (const Node of [CoreNode, CoreTextNode]) {
    const { api, element, tick } = setup()
    element.node = Object.assign(Object.create(Node.prototype), {
      props: { color: 0xff0000ff }, updateType: 0,
    })
    const transformed = element.props.props
    element.config.parent.props = { __layout: true }
    element.config.parent.triggerLayout = () => assert.fail('Color changes must not trigger layout')
    const set = element.set
    let writes = 0
    element.set = function (prop, value) {
      assert.equal(prop, 'color')
      assert.equal(typeof value, 'number')
      writes++
      return set.call(this, prop, value)
    }
    const controller = api.animate(element, {
      color: { from: 'blue', to: 'transparent' },
    }, { duration: 100, easing: 'linear' })
    tick(0)
    assert.equal(element.node.color, 0x0000ffff)
    tick(50)
    assert.equal(element.node.color, 0x00008080)
    tick(100)
    await controller
    assert.equal(element.node.color, 0)
    assert.equal(element.props.raw.color, 0)
    assert.ok(element.node.updateType)
    assert.equal(element.props.props, transformed)
    controller.reset()
    assert.equal(element.node.color, 0xff0000ff)
    assert.equal(element.props.raw.color, 0xff0000ff)
    assert.equal(writes, 4)
  }
})

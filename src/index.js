import symbols from '@lightningjs/blits/symbols'
import htmlColors from '@lightningjs/blits/colors'

const shortHex = /^#[\da-f]{3}$/i
const hex = /^#[\da-f]{6}([\da-f]{2})?$/i
const packedHex = /^0x[\da-f]{8}$/i

let elementId = 0
const elementIds = new WeakMap()
const activeJobs = new Set()
const controllerJob = Symbol('job')
const controllerPromise = Symbol('promise')
const controllerOutcome = Symbol('outcome')
const groupStateSymbol = Symbol('group')
let renderer
let frameTickHandler

const easings = {
  linear: (t) => t,
  ease: (t) => 1 - Math.pow(1 - t, 3),
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 3),
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  'ease-in-back': (t) => {
    const c1 = 1.70158
    return (c1 + 1) * t * t * t - c1 * t * t
  },
  'ease-out-back': (t) => {
    const c1 = 1.70158
    return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  'ease-in-out-back': (t) => {
    const c2 = 1.70158 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },
}

const controllerPrototype = {
  pause() {
    const job = this[controllerJob]
    if (job !== undefined && !job.settled) {
      job.individuallyPaused = true
      updateJobPause(job)
    }
    return this
  },

  resume() {
    const job = this[controllerJob]
    if (job !== undefined && !job.settled) {
      job.individuallyPaused = false
      updateJobPause(job)
    }
    return this
  },

  cancel() {
    const job = this[controllerJob]
    if (job !== undefined) settleJob(job, 'cancelled')
    return this
  },

  reset() {
    const job = this[controllerJob]
    if (job !== undefined) {
      settleJob(job, 'reset')
      for (const segment of job.segments) {
        segment.element.set(segment.prop, segment.resetValue)
      }
    }
    return this
  },

  dispose() {
    const job = this[controllerJob]
    if (job !== undefined) disposeJob(job)
    return this
  },

  get outcome() {
    return this[controllerOutcome]
  },

  then(onFulfilled, onRejected) {
    return this[controllerPromise].then(onFulfilled, onRejected)
  },

  catch(onRejected) {
    return this[controllerPromise].catch(onRejected)
  },

  finally(onFinally) {
    return this[controllerPromise].finally(onFinally)
  },
}

const factories = {
  animate(targets, properties, options) {
    const groupState = getGroupState(this)
    const multipleTargets = Array.isArray(targets) === true
    const targetCount = multipleTargets === true ? targets.length : 1
    const props = Object.keys(properties)
    const duration =
      options === undefined || options.duration === undefined ? 300 : options.duration
    const delay = options === undefined || options.delay === undefined ? 0 : options.delay
    const easing = options === undefined ? undefined : options.easing
    const segments = []

    for (let targetIndex = 0; targetIndex < targetCount; targetIndex++) {
      const target = multipleTargets === true ? targets[targetIndex] : targets
      const element = getElement(target)

      for (const prop of props) {
        const property = properties[prop]
        const hasFromTo =
          property !== null &&
          typeof property === 'object' &&
          Array.isArray(property) === false &&
          hasOwn(property, 'to') === true

        segments.push(
          createSegment(
            {
              element,
              prop,
              value: hasFromTo === true ? property.to : property,
              explicitFrom: hasFromTo === true ? property.from : undefined,
              hasExplicitFrom: hasFromTo === true && hasOwn(property, 'from') === true,
              easing,
            },
            delay,
            duration
          )
        )
      }
    }

    return addJob(segments, groupState)
  },

  sequence(steps) {
    const groupState = getGroupState(this)
    let cursor = 0
    const segments = steps.map((step) => {
      const delay = step.delay || 0
      const segment = createSegment(createSequenceStep(step), cursor + delay, step.duration)
      cursor = segment.end
      return segment
    })

    return addJob(segments, groupState)
  },

  timeline(items, timelineDuration = 1000) {
    const groupState = getGroupState(this)
    const groups = buildTimelineGroups(items)
    const segments = []

    for (const group of groups.values()) {
      group.sort((a, b) => a.at - b.at)
      validateTimelineGroup(group)

      for (const step of group) {
        segments.push(
          createSegment(step, timelineDuration * step.at, timelineDuration * step.duration)
        )
      }
    }

    return addJob(segments, groupState)
  },
}

const groupPrototype = {
  ...factories,
  pause() {
    const groupState = this[groupStateSymbol]
    if (groupState.disposed || groupState.paused) return this
    groupState.paused = true
    for (const job of groupState.jobs) updateJobPause(job)
    return this
  },
  resume() {
    const groupState = this[groupStateSymbol]
    if (groupState.disposed || !groupState.paused) return this
    groupState.paused = false
    for (const job of groupState.jobs) updateJobPause(job)
    return this
  },
  cancel() {
    for (const job of this[groupStateSymbol].jobs) settleJob(job, 'cancelled')
    return this
  },
  dispose() {
    const groupState = this[groupStateSymbol]
    groupState.disposed = true
    for (const job of groupState.jobs) disposeJob(job)
    return this
  },
}

function getGroupState(receiver) {
  const groupState = receiver && receiver[groupStateSymbol]
  assertGroupOpen(groupState)
  return groupState
}

function assertGroupOpen(groupState) {
  if (groupState && groupState.disposed) throw new Error('Animation group is disposed')
}

const animate = {
  name: 'animate',

  plugin() {
    return {
      init(applicationOrRenderer) {
        const nextRenderer = getRenderer(applicationOrRenderer)

        if (renderer === nextRenderer) return

        if (renderer && frameTickHandler) {
          renderer.off('frameTick', frameTickHandler)
        }

        renderer = nextRenderer
        frameTickHandler = (_renderer, data) => tick(data || _renderer)
        renderer.on('frameTick', frameTickHandler)
      },

      ...factories,
      group() {
        const group = Object.create(groupPrototype)
        group[groupStateSymbol] = { jobs: new Set(), disposed: false, paused: false }
        return group
      },
    }
  },
}

function getRenderer(applicationOrRenderer) {
  if (applicationOrRenderer && typeof applicationOrRenderer[symbols.renderer] === 'function') {
    return applicationOrRenderer[symbols.renderer]()
  }

  return applicationOrRenderer
}

function addJob(segments, groupState) {
  assertGroupOpen(groupState)
  if (!renderer) {
    return createController(
      undefined,
      Promise.reject(new Error('Animation plugin is not initialized with a renderer'))
    )
  }

  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  const job = {
    segments,
    activeSegments: [],
    nextSegmentIndex: 0,
    remainingSegments: segments.length,
    startTime: null,
    lastTime: null,
    pauseTime: null,
    resumePending: false,
    paused: false,
    individuallyPaused: false,
    settled: false,
    resolve,
    groupState,
    controller: null,
  }
  const controller = createController(job, promise)

  if (segments.length === 0) {
    settleJob(job, 'completed')
    return controller
  }

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    segment.scheduleOrder = index
    segment.resetValue = segment.element.node && segment.element.node[segment.prop]
    if (segment.prop === 'color') segment.resetValue = parseColor(segment.resetValue)
  }
  segments.sort((a, b) => a.start - b.start || a.scheduleOrder - b.scheduleOrder)

  // Target getters during reset capture can close the group too.
  assertGroupOpen(groupState)
  if (groupState) groupState.jobs.add(job)
  activeJobs.add(job)
  updateJobPause(job)
  return controller
}

function updateJobPause(job) {
  const paused = job.individuallyPaused || Boolean(job.groupState && job.groupState.paused)
  if (paused === job.paused) return
  job.paused = paused
  if (paused) {
    // A resume followed by another pause before a frame keeps the original pause time.
    if (!job.resumePending) job.pauseTime = job.lastTime
    activeJobs.delete(job)
  } else {
    job.resumePending = job.startTime !== null
    activeJobs.add(job)
  }
}

function createController(job, promise) {
  const controller = Object.create(controllerPrototype)
  controller[controllerJob] = job
  controller[controllerPromise] = promise
  controller[controllerOutcome] = null
  if (job) job.controller = controller
  return controller
}

function settleJob(job, outcome) {
  if (job.settled === true) return
  job.settled = true
  job.controller[controllerOutcome] = outcome
  activeJobs.delete(job)
  if (job.groupState) job.groupState.jobs.delete(job)
  job.groupState = null
  job.activeSegments.length = 0
  // Reset only needs targets, property names and creation-time values.
  for (const segment of job.segments) {
    segment.onEnd = null
    segment.easing = null
    segment.easingFunction = null
  }
  const resolve = job.resolve
  job.resolve = null
  resolve()
}

function disposeJob(job) {
  settleJob(job, 'disposed')
  for (const segment of job.segments) {
    segment.element = null
  }
  job.segments.length = 0
  job.activeSegments.length = 0
  job.controller[controllerJob] = undefined
  job.controller = null
}

function tick(data) {
  if (!data || typeof data.time !== 'number') return

  for (const job of activeJobs) {
    if (job.resumePending === true) {
      job.startTime += data.time - job.pauseTime
      job.resumePending = false
    }
    job.lastTime = data.time
    if (job.startTime === null) job.startTime = data.time

    const elapsed = data.time - job.startTime
    const segments = job.segments
    const activeSegments = job.activeSegments
    let nextSegmentIndex = job.nextSegmentIndex

    while (nextSegmentIndex < segments.length && segments[nextSegmentIndex].start <= elapsed) {
      activeSegments.push(segments[nextSegmentIndex])
      nextSegmentIndex++
    }
    job.nextSegmentIndex = nextSegmentIndex

    let activeCount = 0
    for (let index = 0; index < activeSegments.length; index++) {
      const segment = activeSegments[index]
      if (!job.paused && !segment.finished) updateSegment(segment, elapsed, job)
      if (job.settled) break

      if (!segment.finished) {
        activeSegments[activeCount] = segment
        activeCount++
      }
    }
    if (job.settled) continue
    activeSegments.length = activeCount

    if (job.remainingSegments === 0) {
      settleJob(job, 'completed')
    }
  }
}

function createSegment(step, start, duration) {
  if (step.prop === 'color') {
    step.red = step.green = step.blue = step.alpha = 0
    step.redDelta = step.greenDelta = step.blueDelta = step.alphaDelta = 0
    step.value = parseColor(step.value)
    if (step.hasExplicitFrom === true) step.explicitFrom = parseColor(step.explicitFrom)
  }
  step.start = start
  step.duration = duration
  step.end = start + duration
  step.from = undefined
  step.inverseDuration = duration === 0 ? 0 : 1 / duration
  step.valueDelta = undefined
  step.easingFunction = getEasing(step.easing)
  step.started = false
  step.finished = false
  return step
}

function updateSegment(segment, elapsed, job) {
  if (segment.prop === 'color') {
    updateColorSegment(segment, elapsed, job)
    return
  }
  if (!segment.started) {
    segment.started = true
    if (segment.hasExplicitFrom === true) {
      segment.from = normalizeNumericValue(segment.explicitFrom)
      segment.element.set(segment.prop, segment.from)
    } else {
      normalizeElementNumericProp(segment.element, segment.prop)
      segment.from = normalizeNumericValue(
        segment.element.node && segment.element.node[segment.prop]
      )
    }
    segment.value = normalizeNumericValue(segment.value)
    segment.valueDelta = segment.value - segment.from

    if (segment.from === segment.value) {
      finishSegment(segment, job)
      return
    }
  }

  const progress =
    segment.duration === 0 ? 1 : Math.min(1, (elapsed - segment.start) * segment.inverseDuration)
  const value = segment.from + segment.valueDelta * segment.easingFunction(progress)
  if (job.settled) return

  segment.element.set(segment.prop, progress === 1 ? segment.value : value)

  if (progress === 1) finishSegment(segment, job)
}

function updateColorSegment(segment, elapsed, job) {
  if (!segment.started) {
    segment.started = true
    const from =
      segment.hasExplicitFrom === true
        ? segment.explicitFrom
        : parseColor(segment.element.node.color)
    const to = segment.value
    segment.red = from >>> 24
    segment.green = (from >>> 16) & 255
    segment.blue = (from >>> 8) & 255
    segment.alpha = from & 255
    segment.redDelta = (to >>> 24) - segment.red
    segment.greenDelta = ((to >>> 16) & 255) - segment.green
    segment.blueDelta = ((to >>> 8) & 255) - segment.blue
    segment.alphaDelta = (to & 255) - segment.alpha

    if (from === to) {
      segment.element.set('color', to)
      finishSegment(segment, job)
      return
    }
  }

  const progress =
    segment.duration === 0 ? 1 : Math.min(1, (elapsed - segment.start) * segment.inverseDuration)
  let value = segment.value
  if (progress < 1) {
    // Back easings can overshoot; keep all channels within their byte range.
    const eased = Math.max(0, Math.min(1, segment.easingFunction(progress)))
    if (job.settled) return
    value =
      ((Math.round(segment.red + segment.redDelta * eased) << 24) |
        (Math.round(segment.green + segment.greenDelta * eased) << 16) |
        (Math.round(segment.blue + segment.blueDelta * eased) << 8) |
        Math.round(segment.alpha + segment.alphaDelta * eased)) >>>
      0
  }
  segment.element.set('color', value)
  if (progress === 1) finishSegment(segment, job)
}

function parseColor(value) {
  if (typeof value === 'string') {
    if (hasOwn(htmlColors, value)) return Number(htmlColors[value])
    if (shortHex.test(value)) {
      return parseInt(`${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}ff`, 16)
    }
    if (hex.test(value)) {
      return value.length === 7
        ? (parseInt(value.slice(1), 16) * 256 + 255) >>> 0
        : parseInt(value.slice(1), 16)
    }
    if (packedHex.test(value)) return Number(value)
  }
  if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff) return value
  throw new Error('Invalid color: use an HTML color name, 0xRRGGBBAA, #RGB, #RRGGBB, or #RRGGBBAA')
}

function finishSegment(segment, job) {
  segment.finished = true
  job.remainingSegments--
  const onEnd = segment.onEnd
  segment.onEnd = null
  if (onEnd) onEnd.call(segment)
}

function getEasing(easing) {
  if (typeof easing === 'function') return easing
  return easings[easing || 'ease'] || easings.linear
}

function getElement(element) {
  return element && element.$componentId ? element[symbols.holder] : element
}

function normalizeElementNumericProp(element, prop) {
  const value = element.node && element.node[prop]
  const normalizedValue = normalizeNumericValue(value)

  if (normalizedValue !== value) {
    element.set(prop, normalizedValue)
  }
}

function normalizeNumericValue(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }

  return value
}

function hasOwn(object, prop) {
  return Object.prototype.hasOwnProperty.call(object, prop)
}

function buildTimelineGroups(items) {
  const groups = new Map()

  for (const item of items) {
    if (isTimelineGroup(item)) {
      addTimelineGroup(groups, item)
    } else {
      addTimelineStep(groups, createTimelineStepFromFlat(normalizeFlatTimelineStep(item)))
    }
  }

  return groups
}

function addTimelineGroup(groups, group) {
  let cursor = group.at == null ? 0 : group.at

  for (const step of group.steps) {
    const duration = step.duration

    if (duration == null) {
      throw new Error(`Timeline group step for "${step.prop}" is missing "duration"`)
    }

    const at = step.at == null ? cursor : step.at

    addTimelineStep(
      groups,
      createTimelineStep(step, step.element == null ? group.element : step.element, at, duration)
    )

    if (step.at == null) cursor += duration
  }
}

function normalizeFlatTimelineStep(step) {
  if (step.at == null) {
    throw new Error(
      `Timeline step for "${step.prop}" is missing "at". Use a group if you want sequential auto-placement.`
    )
  }

  if (step.duration == null) {
    throw new Error(`Timeline step for "${step.prop}" is missing "duration"`)
  }

  return step
}

function createSequenceStep(step) {
  return createStep(step, getElement(step.element), step.at, step.duration)
}

function createTimelineStepFromFlat(step) {
  return createStep(step, getElement(step.element), step.at, step.duration)
}

function createTimelineStep(step, element, at, duration) {
  return createStep(step, getElement(element), at, duration)
}

function createStep(step, element, at, duration) {
  return {
    element,
    prop: step.prop,
    value: step.value,
    at,
    duration,
    delay: step.delay,
    easing: step.easing,
    onEnd: step.onEnd,
  }
}

function addTimelineStep(groups, step) {
  const key = getStepKey(step)

  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(step)
}

function isTimelineGroup(item) {
  return item && Array.isArray(item.steps)
}

function validateTimelineGroup(steps) {
  for (const step of steps) {
    const at = step.at == null ? 0 : step.at
    const duration = step.duration == null ? 0 : step.duration
    const end = at + duration

    if (step.element == null) {
      throw new Error(`Timeline step for "${step.prop}" is missing "element"`)
    }

    if (step.prop == null) throw new Error('Timeline step is missing "prop"')
    if (at < 0 || at > 1) throw new Error('Invalid timeline step: "at" must be between 0 and 1')
    if (duration < 0 || duration > 1) {
      throw new Error('Invalid timeline step: "duration" must be between 0 and 1')
    }
    if (end > 1) {
      throw new Error(
        `Invalid timeline step: at (${at}) + duration (${duration}) exceeds timeline length`
      )
    }
  }

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]
    const curr = steps[i]

    if (curr.at < prev.at + prev.duration) {
      throw new Error(
        `Overlapping timeline steps are not allowed for the same element and prop ("${curr.prop}")`
      )
    }
  }
}

function getStepKey(step) {
  return `${getElementId(step.element)}::${step.prop}`
}

function getElementId(element) {
  if (!elementIds.has(element)) elementIds.set(element, `el_${++elementId}`)
  return elementIds.get(element)
}

export default animate

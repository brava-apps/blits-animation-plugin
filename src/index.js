import symbols from '@lightningjs/blits/symbols'

let elementId = 0
const elementIds = new WeakMap()
const activeJobs = new Set()
const controllerJob = Symbol('job')
const controllerPromise = Symbol('promise')
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
    if (job !== undefined && job.settled === false && job.paused === false) {
      job.paused = true
      job.pauseTime = job.lastTime
      activeJobs.delete(job)
    }
    return this
  },

  resume() {
    const job = this[controllerJob]
    if (job !== undefined && job.settled === false && job.paused === true) {
      job.paused = false
      job.resumePending = job.startTime !== null
      activeJobs.add(job)
    }
    return this
  },

  cancel() {
    const job = this[controllerJob]
    if (job !== undefined) settleJob(job)
    return this
  },

  reset() {
    const job = this[controllerJob]
    if (job !== undefined) {
      settleJob(job)
      for (const segment of job.segments) {
        segment.element.set(segment.prop, segment.resetValue)
      }
    }
    return this
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

      sequence(steps) {
        let cursor = 0
        const segments = steps.map((step) => {
          const delay = step.delay || 0
          const segment = createSegment(createSequenceStep(step), cursor + delay, step.duration)
          cursor = segment.end
          return segment
        })

        return addJob(segments)
      },

      timeline(items, timelineDuration = 1000) {
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

        return addJob(segments)
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

function addJob(segments) {
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
    settled: false,
    resolve,
  }

  if (segments.length === 0) {
    settleJob(job)
    return createController(job, promise)
  }

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    segment.scheduleOrder = index
    segment.resetValue = segment.element.node && segment.element.node[segment.prop]
  }
  segments.sort((a, b) => a.start - b.start || a.scheduleOrder - b.scheduleOrder)

  activeJobs.add(job)
  return createController(job, promise)
}

function createController(job, promise) {
  const controller = Object.create(controllerPrototype)
  controller[controllerJob] = job
  controller[controllerPromise] = promise
  return controller
}

function settleJob(job) {
  if (job.settled === true) return
  job.settled = true
  activeJobs.delete(job)
  job.resolve()
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
      updateSegment(segment, elapsed, job)

      if (!segment.finished) {
        activeSegments[activeCount] = segment
        activeCount++
      }
    }
    activeSegments.length = activeCount

    if (job.remainingSegments === 0) {
      settleJob(job)
    }
  }
}

function createSegment(step, start, duration) {
  return {
    ...step,
    start,
    duration,
    end: start + duration,
    from: undefined,
    inverseDuration: duration === 0 ? 0 : 1 / duration,
    valueDelta: undefined,
    easingFunction: getEasing(step.easing),
    started: false,
    finished: false,
  }
}

function updateSegment(segment, elapsed, job) {
  if (!segment.started) {
    segment.started = true
    normalizeElementNumericProp(segment.element, segment.prop)
    segment.from = normalizeNumericValue(segment.element.node && segment.element.node[segment.prop])
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

  segment.element.set(segment.prop, progress === 1 ? segment.value : value)

  if (progress === 1) finishSegment(segment, job)
}

function finishSegment(segment, job) {
  segment.finished = true
  job.remainingSegments--
  if (segment.onEnd) segment.onEnd()
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

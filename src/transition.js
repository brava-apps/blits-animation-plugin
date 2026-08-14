import symbols from '@lightningjs/blits/symbols'

let elementId = 0
const elementIds = new WeakMap()

const transitionEngine = {
  name: 'animate',

  plugin() {
    return {
      async sequence(steps) {
        for (const step of steps) {
          await runStep(createSequenceStep(step))
        }
      },

      async timeline(items, timelineDuration = 1000) {
        const groups = buildTimelineGroups(items)

        for (const group of groups.values()) {
          group.sort((a, b) => a.at - b.at)
          validateTimelineGroup(group)
        }

        await Promise.all(
          Array.from(groups.values()).map((group) => runTimelineGroup(group, timelineDuration))
        )
      },
    }
  },
}

function runStep(step, durationOverride, delayOverride) {
  return new Promise((resolve) => {
    const element = step.element
    normalizeElementNumericProp(element, step.prop)
    const targetValue = normalizeNumericValue(step.value)

    if (element.node && element.node[step.prop] === targetValue) {
      if (step.onEnd) step.onEnd()
      resolve()
      return
    }

    element.set(step.prop, {
      transition: {
        value: targetValue,
        duration: durationOverride == null ? step.duration : durationOverride,
        delay: delayOverride == null ? step.delay : delayOverride,
        easing: step.easing,
        end: () => {
          if (step.onEnd) step.onEnd()
          resolve()
        },
      },
    })
  })
}

function getElement(element) {
  return element && element.$componentId ? element[symbols.holder] : element
}

function normalizeElementNumericProp(element, prop) {
  const value = element.node && element.node[prop]
  const normalizedValue = normalizeNumericValue(value)

  if (normalizedValue !== value) element.set(prop, normalizedValue)
}

function normalizeNumericValue(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }

  return value
}

async function runTimelineGroup(steps, timelineDuration) {
  let previousEndTime = 0

  for (const step of steps) {
    const startTime = timelineDuration * step.at
    const stepDuration = timelineDuration * step.duration
    const endTime = startTime + stepDuration
    const delay = Math.max(0, startTime - previousEndTime)

    await runStep(step, stepDuration, delay)
    previousEndTime = endTime
  }
}

function buildTimelineGroups(items) {
  const groups = new Map()

  for (const item of items) {
    if (isTimelineGroup(item)) addTimelineGroup(groups, item)
    else addTimelineStep(groups, createTimelineStepFromFlat(normalizeFlatTimelineStep(item)))
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

export default transitionEngine

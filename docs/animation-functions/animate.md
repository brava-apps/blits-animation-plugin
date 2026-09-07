# Animations functions

## Animate

`this.$animate.animate()` animates multiple numeric properties on one or more Elements or
Components at the same time. It starts immediately and returns an animation controller that can be
paused, resumed, cancelled, reset, or awaited until the animation completes.

```js
await this.$animate.animate(
  this.$select('card'),
  { x: 400, alpha: 1, scale: 1.1 },
  { duration: 300, easing: 'ease-out' }
)
```

The signature is `animate(targets, properties, options?)`.

## Targets

`targets` can be one Element or Component, or an Array of Elements and Components. All targets use
the same properties and timing.

```js
await this.$animate.animate(
  [this.$select('card1'), this.$select('card2')],
  { alpha: 1 },
  { duration: 200 }
)
```

## Properties

Each property can contain its destination value:

```js
{ x: 400, alpha: 1 }
```

Use `{ from, to }` when an animation needs an explicit starting value. Without `from`, the current
value is read when the animation starts.

```js
await this.$animate.animate(
  this.$select('card'),
  {
    x: { from: -200, to: 400 },
    alpha: { from: 0, to: 1 },
  },
  { duration: 300 }
)
```

## Options

- `duration` (optional) - duration in milliseconds; defaults to `300`
- `delay` (optional) - delay before the animation starts in milliseconds; defaults to `0`
- `easing` (optional) - named easing or easing function


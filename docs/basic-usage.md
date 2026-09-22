# Basic usage

The Animation plugin has 3 public animation methods: `this.$animate.animate()`,
`this.$animate.sequence()`, and `this.$animate.timeline()`.

The plugin requires Blits 2.10.0 or later within the 2.x release line.

All three methods accept properties that Blits can set, but interpolation requires an interpolatable
value. Numeric values are interpolated directly.

## Color animations

All three methods support solid `color` values using packed `0xRRGGBBAA` numbers or strings,
`#RGB`, `#RRGGBB`, `#RRGGBBAA`, or HTML color names such as `red` and `transparent`.
RGBA channels are interpolated separately, with color easing clamped to avoid overshoot.
Gradient objects and shader colors are not supported at the moment.

## Animate

`this.$animate.animate()` animates multiple properties on one or more Elements or Components at the
same time. The optional settings are `duration`, `delay`, and `easing`.

```js
await this.$animate.animate(
  this.$select('logo'),
  {
    x: 800,
    alpha: { from: 0, to: 1 },
    color: { from: '#f00', to: '#00f' },
  },
  { duration: 500, easing: 'ease-out' }
)
```

## Sequence

`this.$animate.sequence()` is a async function for doing animation steps in a sequence. The first parameter is for the `steps` and is a Array with objects with animation instructions for every step.

When a step is finish, the next step will start.

The animation step object has:

- `element` - the `ref` to Element in the template
- `prop` - the name of the prop to do animation
- `value` - the value to do the animation to
- `duration` - the duration of the animation in `ms`
- `easing` (optional) - the easing function to use in the animation

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000 },
  { element: this.$select('logo'), prop: 'y', value: 100, duration: 600, easing: 'ease-in-out-back' },
  { element: this.$select('title'), prop: 'rotation', value: 720, duration: 1200}
])
```

## Timeline

`this.$animate.timeline()` is a async function for doing animation steps simultaniously at specific moments in the timeline.

The first parameter is for `steps` and is a Array with animation step objects. The second parameter is for the duration of the timeline in `ms`.

The animation step object for the _timeline_ is a bit different then the object for the _sequence_.

- `element` - the `ref` to Element in the template
- `prop` - the name of the prop to do animation
- `value` - the value to do the animation to
- `at` - the relative moment to _start_ the animation step (fraction of the total timeline duration)
- `duration` - the relative duration of the animation step (fraction of the total timeline duration - NOT `ms`!)
- `easing` (optional) - the easing function to use in the animation

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.1, duration: 0.4 },
    { element: this.$select('logo'), prop: 'y', value: 300, at: 0.5, duration: 0.3, easing: 'ease-in-out', },
    { element: this.$select('title'), prop: 'alpha', value: 1, at: 0.2, duration: 0.8 },
  ],
  1000
)
```

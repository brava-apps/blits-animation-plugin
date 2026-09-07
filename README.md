# Animation plugin for Blits

## Getting started

First install the Animation plugin from NPM in your App project

```sh
npm install @brava-apps/blits-animation-plugin
```

Then in the `index.js` register the Animation plugin

```js
import Blits from '@lightningjs/blits'
import AnimationPlugin from '@brava-apps/blits-animation-plugin'
import App from './App.js'

Blits.Plugin(AnimationPlugin)

Blits.Launch(App, 'app', {
  // launch settings
})
```

Initialize the plugin with the renderer from the root application. The plugin uses the renderer's
frame tick to update active animations. This initialization is required before calling
`sequence()` or `timeline()`.

```js
import Blits from '@lightningjs/blits'

export default Blits.Application({
  // application config
  hooks: {
    init() {
      this.$animate.init(this)
    },
  },
})
```

Next you can use the plugin from any component via `this.$animate`

## Basic plugin usage

The Animation plugin has 3 public animation methods: `this.$animate.animate()`,
`this.$animate.sequence()`, and `this.$animate.timeline()`.

All three methods start immediately and return an awaitable animation controller.

```js
const animation = this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000 },
])

animation.pause()
animation.resume()
animation.cancel() // stops and resolves normally
animation.reset() // also restores the original property values

await animation
```

### Animate

`this.$animate.animate()` animates multiple properties on one or more Elements or Components at the
same time. Its signature is `animate(targets, properties, options?)`.

```js
await this.$animate.animate(
  this.$select('logo'),
  {
    x: 800,
    alpha: { from: 0, to: 1 },
    scale: 1.1,
  },
  { duration: 500, delay: 100, easing: 'ease-out' }
)
```

### Sequence

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

### Timeline

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

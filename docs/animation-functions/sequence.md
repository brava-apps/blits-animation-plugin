# Animations functions

## Sequence

`this.$animate.sequence()` is a async function for doing animation steps after each other.

The first parameter is the `steps` and is a Array. Every item in this Array is a animation step object. The plugin will start with the first step, wait until this animation is finish, and then it will start the next step.

Because the function is async, you can use `await` when you want to wait until the full sequence is done.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000 },
  { element: this.$select('logo'), prop: 'y', value: 100, duration: 600 },
  { element: this.$select('title'), prop: 'alpha', value: 1, duration: 400 },
])
```

## Step object

A step object tells the plugin which Element must animate, which prop must change, and to which value.

```js
{
  element: this.$select('logo'),
  prop: 'x',
  value: 800,
  duration: 1000,
}
```

The step object has:

- `element` - the Element or Component to do the animation on
- `prop` - the name of the prop to do animation
- `value` - the value to do the animation to
- `duration` - the duration of the animation in `ms`
- `delay` (optional) - wait before this step starts, in `ms`
- `easing` (optional) - the easing function to use in the animation
- `onEnd` (optional) - function that is called when this step is finish

## Element input

The `element` can be a Element from the template, normally selected with `this.$select()`.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000 },
])
```

The `element` can also be a Component. When you give a Component, the plugin will animate the holder Element of that Component.

```js
await this.$animate.sequence([
  { element: this.$select('loader'), prop: 'alpha', value: 0, duration: 300 },
])
```

## Prop input

The `prop` is the Blits prop that must animate. This can be things like `x`, `y`, `w`, `h`, `alpha`, `rotation`, `scale`, or another prop that Blits can animate with a transition.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 700, duration: 700 },
  { element: this.$select('logo'), prop: 'rotation', value: 360, duration: 500 },
  { element: this.$select('logo'), prop: 'alpha', value: 0.5, duration: 300 },
])
```

## Value input

The `value` is the new value for the prop. For most animation props this will be a Number.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 100, duration: 400 },
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 400 },
])
```

## Delay input

With `delay` you can let one step wait before it starts. The `delay` is in `ms`.

The sequence still waits for the full step, so the next step starts after the delay and the animation duration are done.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000, delay: 300 },
  { element: this.$select('logo'), prop: 'y', value: 300, duration: 600 },
])
```

## Easing input

With `easing` you can tell Blits which easing function must be used for the transition.

```js
await this.$animate.sequence([
  {
    element: this.$select('logo'),
    prop: 'x',
    value: 800,
    duration: 1000,
    easing: 'ease-in-out-back',
  },
])
```

## onEnd input

With `onEnd` you can run a function when one step is finish.

```js
await this.$animate.sequence([
  {
    element: this.$select('logo'),
    prop: 'x',
    value: 800,
    duration: 1000,
    onEnd: () => {
      console.log('logo x animation is done')
    },
  },
  { element: this.$select('logo'), prop: 'y', value: 300, duration: 600 },
])
```

## Multiple Elements

Every step can use a different Element. The steps still run in sequence, so this example first moves the `logo`, then fades in the `title`, then moves the `button`.

```js
await this.$animate.sequence([
  { element: this.$select('logo'), prop: 'x', value: 800, duration: 1000 },
  { element: this.$select('title'), prop: 'alpha', value: 1, duration: 400 },
  { element: this.$select('button'), prop: 'y', value: 720, duration: 600 },
])
```

## Good to know

`sequence()` does not start steps at the same time. If you want to start animation steps at specific moments in the same timeline, use [`this.$animate.timeline()`](./timeline.md).

When the Element already has the same value as the `value` in the step, the plugin will skip that transition and continue with the next step.

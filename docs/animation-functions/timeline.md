# Animations functions

## Timeline

`this.$animate.timeline()` is a async function for doing animation steps at specific moments in one timeline.

The first parameter is the `items` and is a Array. Every item in this Array can be a normal animation step object, or a group object with multiple steps inside.

The second parameter is the duration of the full timeline in `ms`. When you don't give this parameter, the timeline duration is `1000ms`.

Because the function is async, you can use `await` when you want to wait until the full timeline is done.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.1, duration: 0.4 },
    { element: this.$select('logo'), prop: 'y', value: 300, at: 0.5, duration: 0.3 },
    { element: this.$select('title'), prop: 'alpha', value: 1, at: 0.2, duration: 0.8 },
  ],
  1000
)
```

## Timeline duration

The second parameter is the total timeline duration in `ms`.

The `at` and `duration` inside the steps are not in `ms`. They are relative values between `0` and `1` and are a _fraction_ of the total timeline duration.

```js
await this.$animate.timeline(
  [
    // starts after 200ms and takes 400ms, because the full timeline is 1000ms
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.2, duration: 0.4 },
  ],
  1000
)
```

When the timeline duration is `2000`, the same step starts after `400ms` and takes `800ms`.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.2, duration: 0.4 },
  ],
  2000
)
```

## Flat step object

A flat step object is the most direct way to add a animation to the timeline.

```js
{
  element: this.$select('logo'),
  prop: 'x',
  value: 800,
  at: 0.1,
  duration: 0.4,
}
```

The flat step object has:

- `element` - the Element or Component to do the animation on
- `prop` - the name of the prop to do animation
- `value` - the value to do the animation to
- `at` - the relative moment to start the animation step
- `duration` - the relative duration of the animation step
- `easing` (optional) - the easing function to use in the animation
- `onEnd` (optional) - function that is called when this step is finish

For flat steps the `at` and `duration` are required.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0, duration: 0.5 },
    { element: this.$select('logo'), prop: 'y', value: 300, at: 0.5, duration: 0.5 },
  ],
  1000
)
```

## Group object

A group object is for writing multiple steps together. This is nice when the steps are for the same Element.

```js
{
  element: this.$select('logo'),
  steps: [
    { prop: 'x', value: 800, at: 0.1, duration: 0.4 },
    { prop: 'y', value: 300, at: 0.1, duration: 0.4 },
  ],
}
```

The group object has:

- `element` - the Element or Component to use for the steps
- `at` (optional) - the relative moment where the group starts
- `steps` - a Array with step objects

The step objects inside a group have:

- `element` (optional) - use another Element for this step
- `prop` - the name of the prop to do animation
- `value` - the value to do the animation to
- `at` (optional) - the relative moment to start this step
- `duration` - the relative duration of this step
- `easing` (optional) - the easing function to use in the animation
- `onEnd` (optional) - function that is called when this step is finish

For group steps the `duration` is required. The `at` can be left out when you want the steps to run after each other (in sequence).

```js
await this.$animate.timeline(
  [
    {
      element: this.$select('logo'),
      steps: [
        { prop: 'x', value: 800, duration: 0.3 },
        { prop: 'y', value: 300, duration: 0.3 },
        { prop: 'rotation', value: 360, duration: 0.4 },
      ],
    },
  ],
  1000
)
```

## Group with start time

When a group has `at`, the group starts from that relative moment. Steps without their own `at` are placed after each other from that group start.

```js
await this.$animate.timeline(
  [
    {
      element: this.$select('logo'),
      at: 0.2,
      steps: [
        { prop: 'x', value: 800, duration: 0.3 },
        { prop: 'y', value: 300, duration: 0.3 },
      ],
    },
  ],
  1000
)
```

In this example the `x` step starts at `0.2` and ends at `0.5`. The `y` step starts at `0.5` and ends at `0.8`.

## Group with custom step times

Inside a group you can still give `at` on a step. Then that step uses its own start moment.

```js
await this.$animate.timeline(
  [
    {
      element: this.$select('logo'),
      steps: [
        { prop: 'x', value: 800, at: 0.1, duration: 0.5 },
        { prop: 'y', value: 300, at: 0.1, duration: 0.5 },
        { prop: 'alpha', value: 0.5, at: 0.7, duration: 0.2 },
      ],
    },
  ],
  1000
)
```

This makes it easy to animate different props of one Element at the same time.

## Mixed input

The timeline Array can have flat step objects and group objects together.

```js
await this.$animate.timeline(
  [
    { element: this.$select('background'), prop: 'alpha', value: 1, at: 0, duration: 1 },
    {
      element: this.$select('logo'),
      at: 0.1,
      steps: [
        { prop: 'x', value: 800, duration: 0.3 },
        { prop: 'rotation', value: 360, duration: 0.3 },
      ],
    },
    { element: this.$select('title'), prop: 'y', value: 200, at: 0.6, duration: 0.3 },
  ],
  1200
)
```

## Element input

The `element` can be a Element from the template, normally selected with `this.$select()`.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.1, duration: 0.4 },
  ],
  1000
)
```

The `element` can also be a Component. When you give a Component, the plugin will animate the holder Element of that Component.

```js
await this.$animate.timeline(
  [
    { element: this.$select('loader'), prop: 'alpha', value: 0, at: 0.2, duration: 0.3 },
  ],
  1000
)
```

## Prop input

The `prop` is the numeric Blits prop that must animate. This can be things like `x`, `y`, `w`, `h`, `alpha`, `rotation`, or `scale`.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 700, at: 0, duration: 0.3 },
    { element: this.$select('logo'), prop: 'rotation', value: 360, at: 0.2, duration: 0.5 },
    { element: this.$select('logo'), prop: 'alpha', value: 0.5, at: 0.7, duration: 0.3 },
  ],
  1000
)
```

## Value input

The `value` is the new value for the prop. For most animation props this will be a Number.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 100, at: 0, duration: 0.5 },
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0.5, duration: 0.5 },
  ],
  1000
)
```

## Easing input

With `easing` you can choose which easing function the plugin uses for the animation.

```js
await this.$animate.timeline(
  [
    {
      element: this.$select('logo'),
      prop: 'x',
      value: 800,
      at: 0.1,
      duration: 0.6,
      easing: 'ease-in-out-back',
    },
  ],
  1000
)
```

## onEnd input

With `onEnd` you can run a function when one step is finish.

```js
await this.$animate.timeline(
  [
    {
      element: this.$select('logo'),
      prop: 'x',
      value: 800,
      at: 0.1,
      duration: 0.6,
      onEnd: () => {
        console.log('logo x animation is done')
      },
    },
  ],
  1000
)
```

## Same Element and same prop

Timeline steps for the same Element and the same prop are not allowed to overlap in time.

This example below is valid because the second `x` animation starts when the first `x` animation is done.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0, duration: 0.5 },
    { element: this.$select('logo'), prop: 'x', value: 100, at: 0.5, duration: 0.5 },
  ],
  1000
)
```

This example will throw a error, because both steps animate `x` on the same Element at the same time (note: duration of step 1 is `0.6` and step 2 starts at `0.5`).

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0, duration: 0.6 },
    { element: this.$select('logo'), prop: 'x', value: 100, at: 0.5, duration: 0.5 },
  ],
  1000
)
```

Animating different props at the same time or in overlap is fine.

```js
await this.$animate.timeline(
  [
    { element: this.$select('logo'), prop: 'x', value: 800, at: 0, duration: 0.6 },
    { element: this.$select('logo'), prop: 'y', value: 300, at: 0.2, duration: 0.6 },
  ],
  1000
)
```

## Good to know

The `at` and `duration` values must be between `0` and `1`.

The end of a step can not be after the end of the timeline. So `at: 0.8` with `duration: 0.4` will throw a error, because together it is `1.2`.

`timeline()` starts steps at moments in the same timeline. If you want every animation step to wait until the previous step is done, use [`this.$animate.sequence()`](./sequence.md).

When the Element already has the same value as the `value` in the step, the plugin will skip that animation and continue with the timeline.

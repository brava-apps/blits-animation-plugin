# Basic examples

These live examples show the most common ways to compose animations. They replay automatically and use the same `sequence()`, `timeline()` and group APIs described in this documentation.

<div class="animation-demo-frame">
  <iframe src="examples/basic/dist/" title="Live Blits animation examples" loading="lazy" allow="autoplay"></iframe>
</div>

## Sequence

A sequence waits for each step before starting the next one. Durations are expressed in milliseconds.

```js
await this.$animate.sequence([
  { element: box, prop: "x", value: 700, duration: 900 },
  { element: box, prop: "y", value: 215, duration: 400 },
  { element: box, prop: "x", value: 34, duration: 900, easing: "ease-in-out" },
]);
```

## Parallel timeline

Timeline steps with the same `at` value start together. Both `at` and `duration` are fractions of the total timeline duration.

```js
await this.$animate.timeline(
  [
    { element: box, prop: "x", value: 700, at: 0, duration: 1 },
    { element: box, prop: "rotation", value: 360, at: 0, duration: 1 },
    { element: box, prop: "scale", value: 1.5, at: 0, duration: 0.5 },
    { element: box, prop: "scale", value: 1, at: 0.5, duration: 0.5 },
  ],
  2200,
);
```

## Multiple elements

A timeline can coordinate steps for different elements. Here, the second element starts one quarter of the way through the timeline.

```js
await this.$animate.timeline(
  [
    { element: firstBox, prop: "x", value: 734, at: 0, duration: 0.75 },
    { element: secondBox, prop: "x", value: 34, at: 0.25, duration: 0.75 },
  ],
  2200,
);
```

## Easing

Use the `easing` property to control how values progress. The live example compares `linear`, `ease-out`, and `ease-out-back` over the same distance and duration.

```js
await this.$animate.timeline(
  [
    {
      element: linearBox,
      prop: "x",
      value: 754,
      at: 0,
      duration: 1,
      easing: "linear",
    },
    {
      element: easeBox,
      prop: "x",
      value: 754,
      at: 0,
      duration: 1,
      easing: "ease-out",
    },
    {
      element: backBox,
      prop: "x",
      value: 754,
      at: 0,
      duration: 1,
      easing: "ease-out-back",
    },
  ],
  2200,
);
```

## Animation groups

These two boxes start moving together. After 1 second we cancel the group, so both stop
halfway. The group can be used again, or disposed when you are done.

```js
const group = this.$animate.group()
group.animate(firstBox, { x: 734 }, { duration: 2200, easing: 'linear' })
group.animate(secondBox, { x: 34 }, { duration: 2200, easing: 'linear' })

await this.pause(1000) // demo helper using this.$setTimeout
group.cancel()
```

Dispose the group in `hooks.destroy` when keeping it on the component.
See [Animation groups](animation-groups.md) for the component example.

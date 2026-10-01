# Animation groups

With `this.$animate.group()` you can put multiple animations in one group. This allows to
cancel or dispose them all at once. A group has the same animation methods as the plugin:

```js
const group = this.$animate.group()
const animation = group.animate(targets, properties, options)
group.sequence(steps)
group.timeline(items, timelineDuration)

group.cancel()  // stop pending work; group remains reusable
group.dispose() // stop pending work, release references and permanently close the group
```

`group.cancel()` stops all animations in the group, also when they are delayed or paused.
The values stay where they are. You can still reset the animations, or start new ones in the group.

`group.dispose()` also stops the animations, but releases their references and closes the group.
After this you cannot start new animations in that group. Calling cancel or dispose again is safe.
Animations outside the group keep running.

Both methods resolve the animations with `undefined`. Pending `onEnd` callbacks are not called.

## Component lifecycle

Initialize the renderer once in the root application with `this.$animate.init(this)`.
Group creation itself does not require initialization. Store groups as plain instance fields,
not reactive state, and dispose them in the component's `destroy` hook:

```js
export default Blits.Component('AnimatedCard', {
  template: '<Element ref="card" w="200" h="100" color="#fff" />',
  hooks: {
    init() {
      this.animations = this.$animate.group()
    },
    ready() {
      this.animations.animate(
        this.$select('card'),
        { alpha: { from: 0, to: 1 } },
        { duration: 200 }
      )
    },
    destroy() {
      this.animations.dispose()
      this.animations = null
    },
  },
})
```

Blits calls the `destroy` hook before removing the elements. The group manages the animations
you start through it, also when the elements belong to another component.
Going offscreen or losing focus does not stop the group. Call `cancel()` when you want to stop
the animations and use the group again later.

## Awaiting an animation

Every controller, including ungrouped controllers, supports `dispose()` and a read-only
`outcome`: `null` while pending, then `completed`, `cancelled`, `reset`, or `disposed`.
Once an animation has an outcome, reset or dispose does not change it. An animation with no
steps finishes immediately. If the renderer is not initialized, awaiting the animation rejects
and the outcome stays `null`.

```js
const animation = this.animations.animate(target, { x: 100 })
await animation
if (animation.outcome !== 'completed') return
// Continue completion-only work here.
```

An await also continues when the animation was cancelled or disposed. Check the outcome when
the next action should only happen after the animation finished.

## Finished animations

When an animation finishes, it is automatically removed from the group. You don't need to
cancel or dispose it afterwards.

If you keep its controller, it still holds the elements and original values for `reset()`.
Disposing the group does not dispose animations that already finished or were cancelled.
When you no longer need reset, drop the controller or call `animation.dispose()`.

`animation.dispose()` releases its elements and callbacks. The values stay where they are.
After disposal, `pause()`, `resume()`, `cancel()` and `reset()` do nothing. You can still await
the animation and read its outcome. Use `cancel()` instead if you still need reset.
These methods return the animation controller, so you can chain them. Group cancel and dispose
return the group.

You can cancel or dispose from an `onEnd` callback too. Other properties of that animation
will stop updating in that frame. Errors thrown from `onEnd` still interrupt the frame handler.

See [Basic examples](basic-examples.md#animation-groups) for a small group demo.

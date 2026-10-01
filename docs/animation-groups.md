# Animation groups

With `this.$animate.group()` you can put multiple animations in one group. This allows to
pause, resume, cancel or dispose them all at once. A group has the same animation methods as the plugin:

```js
const group = this.$animate.group()
const animation = group.animate(targets, properties, options)
group.sequence(steps)
group.timeline(items, timelineDuration)

group.pause()   // temporarily pause the animations
group.resume()  // continue, except animations paused individually
group.cancel()  // end pending animations; they cannot resume
group.dispose() // stop pending work, release references and permanently close the group
```

`group.pause()` temporarily stops the animations, including their delays. Await keeps waiting.
`group.resume()` continues from where they paused. Animations you paused individually stay
paused until you call their own `resume()`. Calling an animation's `resume()` while its group
is paused does not start it yet. New animations in a paused group wait for group resume too.

`group.cancel()` permanently stops all current animations in the group, also when they are delayed or paused.
The values stay where they are and await continues with a `cancelled` outcome. These animations
cannot resume. You can still reset their values, or start new animations in the same group.
Cancel does not change whether the group is paused.

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
These methods return the animation controller, so you can chain them. Group pause, resume,
cancel and dispose return the group. Pause and resume on a disposed group do nothing.

You can cancel or dispose from an `onEnd` callback too. Other properties of that animation
will stop updating in that frame. Errors thrown from `onEnd` still interrupt the frame handler.

See [Basic examples](basic-examples.md#animation-groups) for a small group demo.

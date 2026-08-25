# Installation

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

The plugin uses the renderer's frame tick to update active animations. Initialize it with the
renderer from the root application before calling `sequence()` or `timeline()`:

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

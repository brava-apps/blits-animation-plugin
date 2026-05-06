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

Next you can use the plugin from any component via `this.$animate`

import Blits from '@lightningjs/blits'
import AnimationPlugin from '@brava-apps/blits-animation-plugin'

import App from './App.js'

Blits.Plugin(AnimationPlugin)

Blits.Launch(App, 'app', {
  w: 1920,
  h: 1080,
  debugLevel: 1,
})

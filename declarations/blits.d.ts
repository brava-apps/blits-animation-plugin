import '@lightningjs/blits'
import type { AnimationPluginApi } from './index.js'

declare module '@lightningjs/blits' {
  interface CustomComponentProperties {
    /** Animation API registered with Blits.Plugin(AnimationPlugin). */
    $animate: AnimationPluginApi
  }
}

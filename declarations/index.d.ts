import './blits.js'
import type AnimationPlugin from '../types/index.js'

export type AnimationPluginApi = ReturnType<typeof AnimationPlugin.plugin>
export type * from '../types/index.js'
export { default } from '../types/index.js'

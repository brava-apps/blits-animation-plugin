import './blits.js'
import type AnimationPlugin from '../types/index.js'

export type AnimationPluginApi = ReturnType<typeof AnimationPlugin.plugin>
export { default } from '../types/index.js'

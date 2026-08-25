import Blits from '@lightningjs/blits'

const panel = (x, y, title, description, content) => `
  <Element x="${x}" y="${y}" w="860" h="390" color="#172554" rounded="18">
    <Text x="34" y="26" size="30" color="#f8fafc" content="${title}" />
    <Text x="34" y="72" size="21" color="#94a3b8" content="${description}" />
    ${content}
  </Element>
`

const template = `
  <Element w="1920" h="1080" color="#0f172a">
    <Text x="70" y="48" size="44" color="#f8fafc" content="Basic animation examples" />
    <Text x="70" y="108" size="24" color="#94a3b8" content="Examples replay automatically" />

    ${panel(
      70,
      170,
      '1. Sequence',
      'Steps run one after another',
      `
      <Element x="34" y="178" w="792" h="3" color="#334155" />
      <Element ref="sequenceBox" x="34" y="143" w="70" h="70" color="#8b5cf6" rounded="12" />
      <Text x="34" y="270" size="20" color="#cbd5e1" content="x → y → x" />
    `
    )}

    ${panel(
      990,
      170,
      '2. Parallel timeline',
      'Properties animate at the same time',
      `
      <Element x="34" y="178" w="792" h="3" color="#334155" />
      <Element ref="timelineBox" x="34" y="143" w="70" h="70" color="#38bdf8" rounded="12" />
      <Text x="34" y="270" size="20" color="#cbd5e1" content="x + rotation + scale" />
    `
    )}

    ${panel(
      70,
      600,
      '3. Multiple elements',
      'One timeline coordinates several elements',
      `
      <Element x="34" y="150" w="792" h="3" color="#334155" />
      <Element ref="multiBoxOne" x="34" y="121" w="58" h="58" color="#f59e0b" rounded="29" />
      <Element x="34" y="250" w="792" h="3" color="#334155" />
      <Element ref="multiBoxTwo" x="734" y="221" w="58" h="58" color="#ec4899" rounded="29" />
    `
    )}

    ${panel(
      990,
      600,
      '4. Easing',
      'Compare different easing curves',
      `
      <Text x="34" y="127" size="19" color="#cbd5e1" content="linear" />
      <Element x="145" y="142" w="647" h="2" color="#334155" />
      <Element ref="linearBox" x="145" y="124" w="38" h="38" color="#22c55e" rounded="19" />
      <Text x="34" y="198" size="19" color="#cbd5e1" content="ease-out" />
      <Element x="145" y="213" w="647" h="2" color="#334155" />
      <Element ref="easeBox" x="145" y="195" w="38" h="38" color="#a78bfa" rounded="19" />
      <Text x="34" y="269" size="19" color="#cbd5e1" content="back" />
      <Element x="145" y="284" w="647" h="2" color="#334155" />
      <Element ref="backBox" x="145" y="266" w="38" h="38" color="#fb7185" rounded="19" />
    `
    )}
  </Element>
`

export default Blits.Application({
  template,
  hooks: {
    init() {
      this.$animate.init(this)
    },
    ready() {
      this.replayExamples()
    },
  },
  methods: {
    resetExamples() {
      const initialPositions = {
        sequenceBox: 34,
        timelineBox: 34,
        multiBoxOne: 34,
        multiBoxTwo: 734,
        linearBox: 145,
        easeBox: 145,
        backBox: 145,
      }

      for (const [ref, x] of Object.entries(initialPositions)) this.$select(ref).set('x', x)
      this.$select('sequenceBox').set('y', 143)
      this.$select('timelineBox').set('rotation', 0)
      this.$select('timelineBox').set('scale', 1)
    },
    pause(duration) {
      return new Promise((resolve) => this.$setTimeout(resolve, duration))
    },
    async replayExamples() {
      this.resetExamples()
      await this.pause(500)

      const sequenceBox = this.$select('sequenceBox')
      const timelineBox = this.$select('timelineBox')

      await Promise.all([
        this.$animate.sequence([
          { element: sequenceBox, prop: 'x', value: 700, duration: 900 },
          { element: sequenceBox, prop: 'y', value: 215, duration: 400 },
          { element: sequenceBox, prop: 'x', value: 34, duration: 900, easing: 'ease-in-out' },
        ]),
        this.$animate.timeline(
          [
            { element: timelineBox, prop: 'x', value: 700, at: 0, duration: 1 },
            { element: timelineBox, prop: 'rotation', value: 360, at: 0, duration: 1 },
            {
              element: timelineBox,
              prop: 'scale',
              value: 1.5,
              at: 0,
              duration: 0.5,
              easing: 'ease-out-back',
            },
            { element: timelineBox, prop: 'scale', value: 1, at: 0.5, duration: 0.5 },
          ],
          2200
        ),
        this.$animate.timeline(
          [
            { element: this.$select('multiBoxOne'), prop: 'x', value: 734, at: 0, duration: 0.75 },
            {
              element: this.$select('multiBoxTwo'),
              prop: 'x',
              value: 34,
              at: 0.25,
              duration: 0.75,
            },
          ],
          2200
        ),
        this.$animate.timeline(
          [
            {
              element: this.$select('linearBox'),
              prop: 'x',
              value: 754,
              at: 0,
              duration: 1,
              easing: 'linear',
            },
            {
              element: this.$select('easeBox'),
              prop: 'x',
              value: 754,
              at: 0,
              duration: 1,
              easing: 'ease-out',
            },
            {
              element: this.$select('backBox'),
              prop: 'x',
              value: 754,
              at: 0,
              duration: 1,
              easing: 'ease-out-back',
            },
          ],
          2200
        ),
      ])

      await this.pause(1000)
      this.replayExamples()
    },
  },
})

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import {
  blockOverlapsPageGap,
  calcPageGapSpacerHeight,
  getCanvasRelativeTop,
} from '@/lib/tiptap/page-layout'

export interface PageFlowOptions {
  hasLogo: boolean
}

const pageFlowPluginKey = new PluginKey<DecorationSet>('templatePageFlow')

function buildPageFlowDecorations(
  view: EditorView,
  options: PageFlowOptions
): DecorationSet {
  const canvas = view.dom.closest('.template-page-content')
  if (!(canvas instanceof HTMLElement)) {
    return DecorationSet.empty
  }

  const decorations: Decoration[] = []
  let spacerIndex = 0

  for (let i = 0; i < view.dom.childElementCount; i++) {
    const element = view.dom.children[i]
    if (!(element instanceof HTMLElement)) continue
    if (element.classList.contains('template-page-flow-spacer')) continue

    const pos = view.posAtDOM(element, 0)
    if (pos < 0) continue

    const blockTop = getCanvasRelativeTop(element, canvas)
    const blockHeight = element.offsetHeight

    if (!blockOverlapsPageGap(blockTop, blockHeight, options.hasLogo)) {
      continue
    }

    const spacerHeight = calcPageGapSpacerHeight(blockTop, options.hasLogo)

    decorations.push(
      Decoration.widget(
        pos,
        () => {
          const spacer = document.createElement('div')
          spacer.className = 'template-page-flow-spacer'
          spacer.style.height = `${spacerHeight}px`
          spacer.style.width = '100%'
          spacer.style.display = 'block'
          spacer.style.flexShrink = '0'
          spacer.style.pointerEvents = 'none'
          spacer.setAttribute('contenteditable', 'false')
          spacer.setAttribute('aria-hidden', 'true')
          return spacer
        },
        {
          side: -1,
          block: true,
          key: `template-page-flow-${spacerIndex++}-${spacerHeight}`,
        }
      )
    )
  }

  return DecorationSet.create(view.state.doc, decorations)
}

function decorationSetsEqual(a: DecorationSet, b: DecorationSet): boolean {
  const left = a.find()
  const right = b.find()
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i].from !== right[i].from) {
      return false
    }
  }
  return true
}

function createPageFlowPlugin(options: PageFlowOptions) {
  return new Plugin({
    key: pageFlowPluginKey,
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(pageFlowPluginKey)
        if (meta instanceof DecorationSet) {
          return meta
        }
        return value.map(tr.mapping, newState.doc)
      },
    },
    props: {
      decorations(state) {
        return pageFlowPluginKey.getState(state) ?? DecorationSet.empty
      },
    },
    view(view) {
      let frame = 0
      let settlePass = 0

      const scheduleUpdate = () => {
        cancelAnimationFrame(frame)
        settlePass = 0

        const runPass = () => {
          const next = buildPageFlowDecorations(view, options)
          const current = pageFlowPluginKey.getState(view.state) ?? DecorationSet.empty

          if (!decorationSetsEqual(current, next)) {
            view.dispatch(view.state.tr.setMeta(pageFlowPluginKey, next))
            settlePass += 1
            if (settlePass < 12) {
              frame = requestAnimationFrame(runPass)
            }
            return
          }
        }

        frame = requestAnimationFrame(runPass)
      }

      scheduleUpdate()

      return {
        update() {
          scheduleUpdate()
        },
        destroy() {
          cancelAnimationFrame(frame)
        },
      }
    },
  })
}

export const PageFlow = Extension.create<PageFlowOptions>({
  name: 'pageFlow',

  addOptions() {
    return {
      hasLogo: false,
    }
  },

  addProseMirrorPlugins() {
    return [createPageFlowPlugin(this.options)]
  },
})

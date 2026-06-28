import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import {
  calcRequiredSpacerHeight,
  getCollapsedBlockGap,
  getPageTopInset,
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
  let flowY = getPageTopInset(options.hasLogo)
  let previousElement: HTMLElement | null = null

  for (let i = 0; i < view.dom.childElementCount; i++) {
    const element = view.dom.children[i]
    if (!(element instanceof HTMLElement)) continue
    if (element.classList.contains('template-page-flow-spacer')) continue

    flowY += getCollapsedBlockGap(previousElement, element)

    const pos = view.posAtDOM(element, 0)
    if (pos < 0) {
      previousElement = element
      continue
    }

    const blockHeight = element.offsetHeight
    if (blockHeight <= 0) {
      previousElement = element
      continue
    }

    const spacerHeight = calcRequiredSpacerHeight(
      flowY,
      blockHeight,
      options.hasLogo
    )

    if (spacerHeight > 0) {
      const lineSpacer = findLineSpacer(view, pos, element, canvas, options.hasLogo)

      if (lineSpacer) {
        decorations.push(
          createSpacer(lineSpacer.pos, lineSpacer.height, spacerIndex++, true)
        )
        flowY += lineSpacer.height
      } else {
        decorations.push(createSpacer(pos, spacerHeight, spacerIndex++, false))
        flowY += spacerHeight
      }
    }

    flowY += blockHeight
    previousElement = element
  }

  return DecorationSet.create(view.state.doc, decorations)
}

function findLineSpacer(
  view: EditorView,
  nodePos: number,
  element: HTMLElement,
  canvas: HTMLElement,
  hasLogo: boolean
): { pos: number; height: number } | null {
  const node = view.state.doc.nodeAt(nodePos)
  if (!node?.isTextblock || node.textContent.length === 0) return null

  const canvasRect = canvas.getBoundingClientRect()
  const innerStart = nodePos + 1
  const innerEnd = nodePos + node.nodeSize - 1
  if (innerStart >= innerEnd) return null

  const elementRect = element.getBoundingClientRect()
  const blockTop = elementRect.top - canvasRect.top + canvas.scrollTop
  const blockBottom = blockTop + element.offsetHeight

  let overflowPos: number | null = null
  let overflowCoords: { top: number; bottom: number } | null = null

  for (let pos = innerStart; pos <= innerEnd; pos++) {
    try {
      const coords = view.coordsAtPos(pos)
      const lineTop = coords.top - canvasRect.top + canvas.scrollTop
      const lineBottom = coords.bottom - canvasRect.top + canvas.scrollTop
      const lineHeight = Math.max(1, lineBottom - lineTop)

      if (calcRequiredSpacerHeight(lineTop, lineHeight, hasLogo) > 0) {
        overflowPos = pos
        overflowCoords = coords
        break
      }
    } catch {
      break
    }
  }

  if (overflowPos === null || !overflowCoords) return null

  const overflowTop = overflowCoords.top
  let lineStart = overflowPos

  for (let pos = overflowPos - 1; pos >= innerStart; pos--) {
    try {
      const coords = view.coordsAtPos(pos)
      if (Math.abs(coords.top - overflowTop) > 1) break
      lineStart = pos
    } catch {
      break
    }
  }

  const lineTop = overflowCoords.top - canvasRect.top + canvas.scrollTop
  const lineBottom = overflowCoords.bottom - canvasRect.top + canvas.scrollTop
  const lineHeight = Math.max(1, lineBottom - lineTop)
  const height = calcRequiredSpacerHeight(lineTop, lineHeight, hasLogo)

  if (height <= 0) return null

  // If the whole text block is already beyond the writable area, block-level
  // spacing is safer (for example an empty paragraph or a heading at page top).
  if (lineStart <= innerStart && blockBottom - blockTop <= lineHeight + 1) {
    return null
  }

  return { pos: lineStart, height }
}

function createSpacer(
  pos: number,
  height: number,
  index: number,
  inline: boolean
): Decoration {
  return Decoration.widget(
    pos,
    () => {
      const spacer = document.createElement(inline ? 'span' : 'div')
      spacer.className = 'template-page-flow-spacer'
      spacer.style.height = `${height}px`
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
      block: !inline,
      key: `template-page-flow-${index}-${height}`,
    }
  )
}

function decorationSetsEqual(a: DecorationSet, b: DecorationSet): boolean {
  const left = a.find()
  const right = b.find()

  if (left.length !== right.length) return false

  for (let i = 0; i < left.length; i++) {
    if (left[i].from !== right[i].from) return false
    if (left[i].spec.key !== right[i].spec.key) return false
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
      let dispatching = false

      const updateDecorations = () => {
        const currentBeforeClear =
          pageFlowPluginKey.getState(view.state) ?? DecorationSet.empty

        if (currentBeforeClear.find().length > 0) {
          const clearTr = view.state.tr.setMeta(
            pageFlowPluginKey,
            DecorationSet.empty
          )
          clearTr.setMeta('addToHistory', false)

          dispatching = true
          view.dispatch(clearTr)
          dispatching = false
        }

        const next = buildPageFlowDecorations(view, options)
        const current =
          pageFlowPluginKey.getState(view.state) ?? DecorationSet.empty

        if (decorationSetsEqual(current, next)) return

        const tr = view.state.tr.setMeta(pageFlowPluginKey, next)
        tr.setMeta('addToHistory', false)

        dispatching = true
        view.dispatch(tr)
        dispatching = false
      }

      const scheduleUpdate = () => {
        if (dispatching) return
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(updateDecorations)
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

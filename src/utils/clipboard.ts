interface ClipboardTextareaLike {
  value: string
  style: {
    position: string
    top: string
    left: string
  }
  setAttribute: (name: string, value: string) => void
  focus: () => void
  select: () => void
}

interface ClipboardDocumentLike {
  createElement: (tag: string) => ClipboardTextareaLike
  body: {
    appendChild: (node: ClipboardTextareaLike) => void
    removeChild: (node: ClipboardTextareaLike) => void
  }
  execCommand?: (command: string) => boolean
}

export async function copyTextToClipboard(
  text: string,
  options: {
    navigatorObject?: {
      clipboard?: {
        writeText?: (value: string) => Promise<void>
      }
    }
    documentObject?: ClipboardDocumentLike
  } = {},
): Promise<boolean> {
  const navigatorObject = options.navigatorObject ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  const documentObject = options.documentObject ?? (typeof document !== 'undefined'
    ? {
        createElement: (tag: string) => document.createElement(tag) as unknown as ClipboardTextareaLike,
        body: {
          appendChild: (node: ClipboardTextareaLike) => {
            document.body.appendChild(node as unknown as Node)
          },
          removeChild: (node: ClipboardTextareaLike) => {
            document.body.removeChild(node as unknown as Node)
          },
        },
        execCommand:
          typeof document.execCommand === 'function'
            ? document.execCommand.bind(document)
            : undefined,
      }
    : undefined)

  try {
    if (navigatorObject?.clipboard?.writeText) {
      await navigatorObject.clipboard.writeText(text)
      return true
    }
  } catch {
    // Continue to fallback.
  }

  if (!documentObject) {
    return false
  }

  try {
    const textarea = documentObject.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.left = '-9999px'

    documentObject.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const didCopy = typeof documentObject.execCommand === 'function'
      ? documentObject.execCommand('copy')
      : false

    documentObject.body.removeChild(textarea)
    return didCopy
  } catch {
    return false
  }
}

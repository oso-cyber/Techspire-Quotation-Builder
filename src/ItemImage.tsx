import { useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'

async function prepareImage(blob: Blob) {
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('Choose an image file.')
  if (blob.size > 20_000_000) throw new Error('Choose an image smaller than 20 MB.')
  const url = URL.createObjectURL(blob)
  try {
    const source = new Image()
    source.src = url
    await source.decode()
    const scale = Math.min(1, 720 / Math.max(source.naturalWidth, source.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ItemImage({ value, onChange, name, compact = false }: {
  value?: string
  onChange: (value?: string) => void
  name: string
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const latest = useRef(onChange)
  useLayoutEffect(() => { latest.current = onChange }, [onChange])
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const [pending, setPending] = useState(false)

  async function load(file?: File, link = '') {
    if (pending || (!file && !link)) return
    setError('')
    setPending(true)
    try {
      let blob: Blob | undefined = file
      if (!blob && /^(https?:\/\/|data:image\/|blob:)/i.test(link)) {
        const response = await fetch(link, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) })
        if (!response.ok) throw new Error('Image unavailable.')
        blob = await response.blob()
      }
      if (!blob) throw new Error('Image unavailable.')
      latest.current(await prepareImage(blob))
    } catch {
      setError('Could not import this image. Save it as an image file, then drop it here.')
    } finally {
      setPending(false)
    }
  }

  function isImageDrop(event: DragEvent) {
    return event.dataTransfer.types.some((type) => ['Files', 'text/uri-list', 'text/html'].includes(type))
  }

  return <div className={compact ? 'item-image item-image-compact' : 'item-image'} data-image-pending={pending || undefined}>
    <button type="button" className={`image-drop ${over ? 'image-drop-over' : ''}`} aria-label={`Upload image for ${name}`}
      onClick={() => input.current?.click()} onDragOver={(event) => {
        if (!isImageDrop(event)) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }} onDragLeave={() => setOver(false)} onDrop={(event) => {
        if (!isImageDrop(event)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        const html = document.createElement('template')
        html.innerHTML = event.dataTransfer.getData('text/html')
        const link = html.content.querySelector('img')?.getAttribute('src')
          ?? event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find((line) => !line.startsWith('#'))
        void load(event.dataTransfer.files[0], link)
      }} onPaste={(event) => {
        const file = [...event.clipboardData.files].find((entry) => entry.type.startsWith('image/'))
        if (file) { event.preventDefault(); void load(file) }
      }}>
      {value ? <img src={value} alt={name} draggable={false} /> : <ImagePlus size={compact ? 19 : 25} />}
      {!compact && <span>{pending ? 'Importing image…' : value ? 'Drop to replace or browse' : 'Drop, paste or browse for an image'}</span>}
    </button>
    <input ref={input} type="file" accept="image/*" hidden onChange={(event) => {
      void load(event.target.files?.[0])
      event.target.value = ''
    }} />
    {value && <button type="button" className="row-remove image-remove" aria-label={`Remove image for ${name}`} onClick={() => { if (!pending) latest.current(undefined) }}><X size={13} /></button>}
    {error && <small className="image-error" role="alert">{error}</small>}
  </div>
}

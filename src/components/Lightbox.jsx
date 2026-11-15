import { useEffect } from 'react'
import VideoPlayer from './VideoPlayer'

export default function Lightbox({ items, index, onClose, onIndex }) {
  const item = items[index]
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, onClose, onIndex])
  if (!item) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" onClick={onClose}>✕</button>
      {items.length > 1 && (
        <>
          <button className="lb-nav left" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length) }}>‹</button>
          <button className="lb-nav right" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length) }}>›</button>
        </>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        {item.type === 'video' ? <VideoPlayer src={item.src} className="lb-media" /> : <img src={item.src} alt={item.title || ''} className="lb-media" />}
        {item.title && <figcaption>{item.title}</figcaption>}
      </figure>
    </div>
  )
}

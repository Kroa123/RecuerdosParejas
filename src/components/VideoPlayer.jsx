import { videoEmbed } from '../lib/media'

export default function VideoPlayer({ src, className = '' }) {
  const v = videoEmbed(src)
  if (!v) return null
  if (v.kind === 'iframe')
    return (
      <div className={`video-frame ${className}`}>
        <iframe src={v.src} title="video" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
    )
  return <video className={`video-file ${className}`} src={v.src} controls playsInline preload="metadata" />
}

/* Miniatura liviana para cards (no carga el reproductor completo) */
export function VideoThumb({ src }) {
  const v = videoEmbed(src)
  const yt = v?.src.match(/youtube\.com\/embed\/([\w-]+)/)
  if (yt) return <img src={`https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`} alt="" loading="lazy" />
  if (v?.kind === 'file') return <video src={v.src + '#t=0.5'} muted preload="metadata" playsInline />
  return <div className="thumb-empty" />
}

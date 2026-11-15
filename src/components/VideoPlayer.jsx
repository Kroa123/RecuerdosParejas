import { videoEmbed } from '../lib/media'

export default function VideoPlayer({ src, className = '' }) {
  const v = videoEmbed(src)
  if (!v) return null
  if (v.kind === 'iframe')
    return (
      <div className={`video-frame ${className}`}>
        <iframe src={v.src} title="video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      </div>
    )
  return <video className={`video-file ${className}`} src={v.src} controls playsInline preload="metadata" />
}

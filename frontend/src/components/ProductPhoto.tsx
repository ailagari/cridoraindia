import { useState } from 'react'

type Props = { src: string; alt: string; className?: string }

export function ProductPhoto({ src, alt, className = '' }: Props) {
  const [ok, setOk] = useState(true)
  if (!ok) {
    return (
      <div className="media-frame__fallback" role="img" aria-label={alt ? `${alt} unavailable` : 'Image unavailable'}>
        Image unavailable
      </div>
    )
  }
  const imgClass = className.trim() ? `media-fill ${className}` : 'media-fill'
  return (
    <img
      src={src}
      alt={alt}
      className={imgClass}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
    />
  )
}

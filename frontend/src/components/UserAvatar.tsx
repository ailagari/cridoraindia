import { useState, type CSSProperties } from 'react'

type Props = {
  imageUrl?: string
  fallback: string
  className?: string
  style?: CSSProperties
  imageFit?: 'cover' | 'contain'
  alt?: string
}

export function UserAvatar({
  imageUrl = '',
  fallback,
  className = '',
  style,
  imageFit = 'cover',
  alt = '',
}: Props) {
  const [broken, setBroken] = useState(false)
  const src = imageUrl.trim()
  const showImage = src !== '' && !broken

  if (showImage) {
    return (
      <span
        className={`user-avatar user-avatar--image${className ? ` ${className}` : ''}`}
        style={style}
        aria-hidden={alt === '' ? true : undefined}
      >
        <img
          src={src}
          alt={alt}
          className={`user-avatar__img user-avatar__img--${imageFit}`}
          onError={() => setBroken(true)}
        />
      </span>
    )
  }

  return (
    <span
      className={`user-avatar user-avatar--letter${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden
    >
      {fallback}
    </span>
  )
}

import type { CSSProperties } from 'react'

/** Same principle as Cridora v2 `AmbientParticles` — seeded “random” layout, short animation shorthand per dot. */
const KEYFRAMES = [
  'home-hero-particle-1',
  'home-hero-particle-2',
  'home-hero-particle-3',
  'home-hero-particle-4',
] as const

const SEEDS = [
  { t: 8, l: 6, d: 0, dur: 22, a: 0 },
  { t: 18, l: 22, d: 1, dur: 26, a: 1 },
  { t: 5, l: 48, d: 2, dur: 20, a: 2 },
  { t: 32, l: 72, d: 0.5, dur: 28, a: 3 },
  { t: 44, l: 12, d: 3, dur: 24, a: 0 },
  { t: 12, l: 88, d: 1.5, dur: 21, a: 1 },
  { t: 58, l: 38, d: 2.5, dur: 19, a: 2 },
  { t: 70, l: 58, d: 0, dur: 25, a: 3 },
  { t: 26, l: 66, d: 4, dur: 23, a: 0 },
  { t: 82, l: 28, d: 1, dur: 20, a: 1 },
  { t: 14, l: 42, d: 5, dur: 27, a: 2 },
  { t: 62, l: 8, d: 2, dur: 18, a: 3 },
  { t: 36, l: 92, d: 0.2, dur: 24, a: 0 },
  { t: 52, l: 50, d: 3.5, dur: 22, a: 1 },
  { t: 76, l: 18, d: 1, dur: 21, a: 2 },
  { t: 4, l: 34, d: 6, dur: 26, a: 3 },
  { t: 90, l: 78, d: 0, dur: 20, a: 0 },
  { t: 22, l: 14, d: 4, dur: 25, a: 1 },
  { t: 48, l: 84, d: 1.2, dur: 19, a: 2 },
  { t: 66, l: 44, d: 2, dur: 23, a: 3 },
  { t: 39, l: 31, d: 1.3, dur: 22.8, a: 2 },
  { t: 17, l: 73, d: 2.2, dur: 21.5, a: 0 },
  { t: 93, l: 41, d: 0.4, dur: 27.2, a: 1 },
  { t: 7, l: 94, d: 5.8, dur: 18.6, a: 3 },
  { t: 54, l: 3, d: 3.1, dur: 24.4, a: 2 },
  { t: 29, l: 59, d: 7.5, dur: 26.9, a: 0 },
  { t: 71, l: 85, d: 4.9, dur: 22.3, a: 1 },
  { t: 45, l: 19, d: 0.85, dur: 29.6, a: 2 },
  { t: 11, l: 51, d: 5.65, dur: 21.75, a: 3 },
  { t: 61, l: 67, d: 1.95, dur: 20.95, a: 0 },
  { t: 33, l: 95, d: 2.35, dur: 27.95, a: 1 },
] as const

export function HeroArabesqueBackground() {
  return (
    <div className="home-hero-art" aria-hidden>
      <div className="home-hero-art__particles">
        {SEEDS.map((p, index) => {
          const animationName = KEYFRAMES[p.a % 4]
          return (
            <span
              key={index}
              className="home-hero-art__dot"
              style={
                {
                  top: `${p.t}%`,
                  left: `${p.l}%`,
                  animation: `${animationName} ${p.dur}s ease-in-out ${p.d}s infinite`,
                } as CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}

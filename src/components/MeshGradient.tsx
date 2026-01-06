'use client'

import { useMemo } from 'react'

// Procedurally generates a beautiful mesh gradient based on a seed
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function hslToString(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`
}

type GradientPalette = {
  bg: string
  color1: string
  color2: string
  color3: string
}

function generatePalette(seed: number): GradientPalette {
  const r = (n: number) => seededRandom(seed + n)
  
  // Pick a base hue and create harmonious colors
  const baseHue = Math.floor(r(0) * 360)
  const spread = 30 + r(1) * 60 // 30-90 degree spread
  
  // Determine if we want warm (orange/peach like the design) or cool tones
  const warmBias = r(2) > 0.5
  
  if (warmBias) {
    // Warm gradients (like the design image - orange, peach, cream)
    const warmHue = 20 + r(3) * 40 // 20-60 (orange to yellow range)
    return {
      bg: hslToString(warmHue + 20, 30 + r(4) * 20, 92 + r(5) * 6),
      color1: hslToString(warmHue, 70 + r(6) * 25, 55 + r(7) * 15),
      color2: hslToString(warmHue + spread * 0.3, 60 + r(8) * 30, 60 + r(9) * 20),
      color3: hslToString(warmHue - spread * 0.2, 50 + r(10) * 30, 40 + r(11) * 20),
    }
  } else {
    // Cool/neutral gradients (blue, purple, gray tones)
    return {
      bg: hslToString(baseHue, 10 + r(4) * 20, 90 + r(5) * 8),
      color1: hslToString(baseHue, 50 + r(6) * 40, 50 + r(7) * 20),
      color2: hslToString(baseHue + spread, 40 + r(8) * 40, 55 + r(9) * 25),
      color3: hslToString(baseHue - spread * 0.5, 30 + r(10) * 40, 35 + r(11) * 25),
    }
  }
}

function generateMeshGradient(seed: number): string {
  const palette = generatePalette(seed)
  const r = (n: number) => seededRandom(seed + n + 100)
  
  // Create organic blob positions
  const blob1X = 20 + r(0) * 40
  const blob1Y = 20 + r(1) * 30
  const blob2X = 50 + r(2) * 40
  const blob2Y = 60 + r(3) * 30
  const blob3X = 30 + r(4) * 50
  const blob3Y = 40 + r(5) * 40
  
  // Size variation
  const size1 = 35 + r(6) * 25
  const size2 = 30 + r(7) * 30
  const size3 = 25 + r(8) * 25
  
  return `
    radial-gradient(ellipse ${size1}% ${size1 * (0.8 + r(9) * 0.4)}% at ${blob1X}% ${blob1Y}%, ${palette.color1} 0%, transparent 70%),
    radial-gradient(ellipse ${size2}% ${size2 * (0.7 + r(10) * 0.5)}% at ${blob2X}% ${blob2Y}%, ${palette.color2} 0%, transparent 65%),
    radial-gradient(ellipse ${size3}% ${size3 * (0.9 + r(11) * 0.3)}% at ${blob3X}% ${blob3Y}%, ${palette.color3} 0%, transparent 60%),
    linear-gradient(180deg, ${palette.bg} 0%, ${palette.bg} 100%)
  `.trim()
}

interface MeshGradientProps {
  seed: number
  className?: string
  children?: React.ReactNode
}

export function MeshGradient({ seed, className = '', children }: MeshGradientProps) {
  const gradient = useMemo(() => generateMeshGradient(seed), [seed])
  
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: gradient }}
    >
      {children}
    </div>
  )
}

// Re-export urlToSeed from utils for convenience
export { urlToSeed } from '@/lib/utils'


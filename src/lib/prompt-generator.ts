// Procedural prompt generator for article thumbnail images

const TEXTURE_TYPES = [
  'grainy', 'soft grainy', 'noisy', 'film grain', 'textured',
  'granular', 'sandy textured', 'dusty', 'matte grainy', 'powder texture'
]

const STYLES = [
  'fluid gradient', 'color field', 'gradient blend', 'soft focus gradient',
  'diffused color wash', 'atmospheric gradient', 'hazy color field',
  'nebula-like gradient', 'dreamy gradient', 'ethereal blend'
]

const COLOR_COMBOS = [
  'neon yellow and deep purple', 'hot pink and turquoise', 'coral pink and mustard yellow',
  'lime green and violet', 'cyan and coral', 'magenta and chartreuse',
  'pastel pink and butter yellow', 'electric blue and peach', 'mint green and lavender',
  'tangerine and fuchsia', 'lemon yellow and rose pink', 'teal and salmon',
  'lilac and golden yellow', 'bubblegum pink and sky blue', 'acid green and plum purple'
]

const GRADIENT_PATTERNS = [
  'flowing organic shapes', 'soft billowing forms', 'smooth diagonal sweep',
  'circular radial blur', 'layered color waves', 'intersecting color clouds',
  'angular color blocks with soft edges', 'swirling misty forms',
  'horizontal bands with bleed', 'vertical color drift'
]

const GRAIN_DETAILS = [
  'heavy film grain texture', 'fine particle noise', 'medium grain overlay',
  'coarse sandy texture', 'subtle noise pattern', 'visible pixel grain',
  'dusty matte finish', 'chalky textured surface', 'soft focus grain', 'vintage film texture'
]

const ATMOSPHERES = [
  'soft diffused lighting', 'hazy atmospheric depth', 'dreamy out of focus',
  'ethereal glow', 'muted luminosity', 'gentle color bleed',
  'foggy ambiance', 'soft bokeh effect', 'translucent layers', 'misty color transition'
]

const COMPOSITIONS = [
  'asymmetric balance', 'centered composition', 'diagonal flow',
  'corner-to-corner movement', 'layered depth', 'floating color shapes',
  'overlapping gradients', 'edge-to-edge blend', 'concentrated center fade', 'scattered color pools'
]

const FINISHES = [
  'minimalist aesthetic', 'contemporary abstract art', 'modern gradient design',
  'soft artistic blur', 'painterly texture', 'analog photography feel',
  'retro color treatment', 'organic art style', 'meditative color field', 'zen minimalism'
]

// Seeded random number generator for deterministic results
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
}

function pickRandom<T>(array: T[], random: () => number): T {
  return array[Math.floor(random() * array.length)]
}

/**
 * Generate a deterministic prompt based on a seed value
 * Same seed always produces the same prompt
 */
export function generateImagePrompt(seed: number): string {
  const random = seededRandom(Math.abs(seed))
  
  const textureType = pickRandom(TEXTURE_TYPES, random)
  const style = pickRandom(STYLES, random)
  const colorCombo = pickRandom(COLOR_COMBOS, random)
  const gradientPattern = pickRandom(GRADIENT_PATTERNS, random)
  const grainDetail = pickRandom(GRAIN_DETAILS, random)
  const atmosphere = pickRandom(ATMOSPHERES, random)
  const composition = pickRandom(COMPOSITIONS, random)
  const finish = pickRandom(FINISHES, random)
  
  return `${textureType} abstract ${style} with ${colorCombo}, ${gradientPattern}, ${grainDetail}, ${atmosphere}, ${composition}, ${finish}`
}




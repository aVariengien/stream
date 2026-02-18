type ChunkResult = {
  content: string
  wordCount: number
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
}

function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g)
  return matches ? matches.length : 0
}

function splitSentences(text: string): string[] {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return []
  return normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'`(])/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitByWords(text: string, targetWords: number): string[] {
  const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const out: string[] = []
  for (let i = 0; i < words.length; i += targetWords) {
    out.push(words.slice(i, i + targetWords).join(' '))
  }
  return out
}

function splitLargeParagraph(paragraph: string, targetWords: number): string[] {
  const sentences = splitSentences(paragraph)
  if (sentences.length <= 1) {
    return splitByWords(paragraph, targetWords)
  }

  const chunks: string[] = []
  let current = ''
  let currentCount = 0

  for (const sentence of sentences) {
    const sentenceCount = countWords(sentence)
    if (sentenceCount > targetWords) {
      if (current) {
        chunks.push(current.trim())
        current = ''
        currentCount = 0
      }
      chunks.push(...splitByWords(sentence, targetWords))
      continue
    }

    if (currentCount + sentenceCount <= targetWords) {
      current = current ? `${current} ${sentence}` : sentence
      currentCount += sentenceCount
      continue
    }

    chunks.push(current.trim())
    current = sentence
    currentCount = sentenceCount
  }

  if (current) chunks.push(current.trim())
  return chunks.filter(Boolean)
}

export function chunkText(markdown: string, targetWords = 200): ChunkResult[] {
  const clean = markdown.trim()
  if (!clean) return []

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean)

  const chunks: ChunkResult[] = []
  let currentParts: string[] = []
  let currentWords = 0

  const flushCurrent = () => {
    if (!currentParts.length) return
    const content = currentParts.join('\n\n').trim()
    const wordCount = countWords(content)
    if (content && wordCount > 0) {
      chunks.push({ content, wordCount })
    }
    currentParts = []
    currentWords = 0
  }

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph)
    if (paragraphWords > targetWords) {
      flushCurrent()
      const split = splitLargeParagraph(paragraph, targetWords)
      for (const part of split) {
        chunks.push({ content: part, wordCount: countWords(part) })
      }
      continue
    }

    if (currentWords + paragraphWords <= targetWords) {
      currentParts.push(paragraph)
      currentWords += paragraphWords
    } else {
      flushCurrent()
      currentParts.push(paragraph)
      currentWords = paragraphWords
    }
  }

  flushCurrent()
  return chunks
}

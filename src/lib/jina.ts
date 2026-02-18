export function stripJinaHeader(content: string): string {
  const markdownContentMatch = content.match(/Markdown Content:\s*\n([\s\S]*)/)
  if (markdownContentMatch) {
    return markdownContentMatch[1].trim()
  }
  return content.trim()
}

export async function fetchJinaMarkdown(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const response = await fetch(jinaUrl, {
    headers: {
      Accept: 'text/markdown',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch markdown (${response.status})`)
  }
  const content = await response.text()
  return stripJinaHeader(content)
}


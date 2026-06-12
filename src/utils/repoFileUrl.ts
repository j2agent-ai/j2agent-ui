const REPO_FILE_PATH_MARKER = '/file/repo/'

const encodeRepoPathSegments = (relativePath: string) =>
  relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

/**
 * 将历史整段 %2F 编码的知识库直链改为按路径段编码，避免 Tomcat/网关返回 400。
 */
export const normalizeRepoFileUrl = (url: string): string => {
  if (!url?.includes('%2F') || !url.includes(REPO_FILE_PATH_MARKER)) {
    return url
  }
  const markerIdx = url.indexOf(REPO_FILE_PATH_MARKER)
  const prefix = url.slice(0, markerIdx + REPO_FILE_PATH_MARKER.length)
  const remainder = url.slice(markerIdx + REPO_FILE_PATH_MARKER.length)
  const suffixMatch = remainder.match(/[?#].*/)
  const suffix = suffixMatch?.[0] ?? ''
  const encodedTail = suffix ? remainder.slice(0, -suffix.length) : remainder
  try {
    const relativePath = decodeURIComponent(encodedTail)
    if (!relativePath) {
      return url
    }
    return prefix + encodeRepoPathSegments(relativePath) + suffix
  } catch {
    return url
  }
}

/** 规范化 Markdown 正文中嵌入的知识库图片/链接 URL。 */
export const normalizeMarkdownRepoFileUrls = (markdown: string): string => {
  if (!markdown?.includes('%2F') || !markdown.includes(REPO_FILE_PATH_MARKER)) {
    return markdown
  }
  return markdown.replace(
    /(?:https?:\/\/[^\s"')]+|\/v1\/rest\/[^\s"')]+)\/file\/repo\/[^\s"')]+/gi,
    (url) => normalizeRepoFileUrl(url)
  )
}

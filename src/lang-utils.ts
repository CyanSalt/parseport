import path from 'node:path'

export const REGEX_DTS = /\.d\.[cm]?ts(\?.*)?$/
export const REGEX_JS = /\.[cm]?[jt]sx?(\?.*)?$/
export const REGEX_LANG_JS = /^[jt]sx?$/

export function getLang(filename: string): {
  lang: string | undefined,
  sourceType?: 'commonjs' | 'module' | undefined,
} {
  const lang = path.extname(filename).replace(/^\./, '').replace(/\?.*$/, '')
  if (REGEX_DTS.test(filename)) {
    return {
      lang: 'dts',
      sourceType: lang.startsWith('c') ? 'commonjs' : (
        lang.startsWith('m') ? 'module' : undefined
      ),
    }
  }
  if (REGEX_JS.test(filename)) {
    return {
      lang: 'js',
      sourceType: lang.startsWith('c') ? 'commonjs' : (
        lang.startsWith('m') ? 'module' : undefined
      ),
    }
  }
  return { lang }
}

export function getExtname(lang: string | undefined, sourceType?: string): string {
  if (!lang) return ''
  if (lang === 'dts') {
    const prefix = sourceType === 'commonjs' ? 'c' : (
      sourceType === 'module' ? 'm' : ''
    )
    return `.d.${prefix}ts`
  }
  if (REGEX_LANG_JS.test(lang)) {
    const prefix = sourceType === 'commonjs' ? 'c' : (
      sourceType === 'module' ? 'm' : ''
    )
    return `.${prefix}${lang}`
  }
  return `.${lang}`
}

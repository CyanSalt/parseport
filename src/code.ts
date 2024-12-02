import { babelParse, getLang } from 'ast-kit'
import { PARSEPORT_UNKNOWN, parseportNode } from './node'
import type { ParseportOptions } from './types'

export type ParsingResult = ReturnType<typeof babelParse>

export type ParseportParser = (code: string, file?: string, lang?: string) => ParsingResult | Promise<ParsingResult>

export const defaultParser: ParseportParser = (code, file, lang) => {
  return babelParse(code, lang ?? (file ? getLang(file) : undefined))
}

export async function parseportCode(code: string, options?: ParseportOptions) {
  const parser = options?.parser ?? defaultParser
  let ast: ParsingResult
  try {
    ast = await parser(code, options?.file, options?.lang)
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  return parseportNode(ast, options)
}

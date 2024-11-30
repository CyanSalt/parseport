import { babelParse, getLang } from 'ast-kit'
import { parseportNode } from './node'
import type { ParseportOptions } from './options'

export type ParsingResult = ReturnType<typeof babelParse>

export type ParseportParser = (code: string, file?: string, lang?: string) => ParsingResult | Promise<ParsingResult>

const defaultParser: ParseportParser = (code, file, lang) => {
  return babelParse(code, lang ?? (file ? getLang(file) : undefined))
}

export async function parseportCode(code: string, options?: ParseportOptions) {
  const parser = options?.parser ?? defaultParser
  const ast = await parser(code, options?.file, options?.lang)
  return parseportNode(ast, options)
}

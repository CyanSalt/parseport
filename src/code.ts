import type { Program } from '@babel/types'
import { babelParse, getLang } from 'ast-kit'
import { PARSEPORT_UNKNOWN, parseportNode } from './node'
import type { ParseportOptions } from './types'

export type ParseportParser = (code: string, file?: string, lang?: string) => Program | Promise<Program>

export const defaultParser: ParseportParser = (code, file, lang) => {
  return babelParse(code, lang)
}

export async function parseportCode(code: string, options?: ParseportOptions) {
  const parser = options?.parser ?? defaultParser
  const lang = options?.lang ?? (options?.file ? getLang(options.file) : undefined)
  let ast: Program
  try {
    ast = await parser(code, options?.file, lang)
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  return parseportNode(ast, options)
}

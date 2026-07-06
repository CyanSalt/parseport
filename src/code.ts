import type { Node } from 'oxc-parser'
import { parse } from 'oxc-parser'
import { getExtname, getLang } from './lang-utils'
import { parseportNode } from './node'
import { PARSEPORT_UNKNOWN } from './reflect'
import type { ParseportOptions } from './types'

const PARSEPORT_EVALUATED = Symbol('PARSEPORT_EVALUATED')

export interface ParseportEvaluatedNode {
  type: typeof PARSEPORT_EVALUATED,
  value: unknown,
}

export type ParseportNode = Node | ParseportEvaluatedNode

export function createEvaluatedNode(value: unknown): ParseportEvaluatedNode {
  return {
    type: PARSEPORT_EVALUATED,
    value,
  }
}

function isEvaluatedNode(node: ParseportNode): node is ParseportEvaluatedNode {
  return node.type === PARSEPORT_EVALUATED
}

export type ParseportParser = (code: string, file?: string, lang?: string) => ParseportNode | Promise<ParseportNode>

export const defaultParser: ParseportParser = async (code, file, language) => {
  if (language === 'json') {
    const value = JSON.parse(code)
    return createEvaluatedNode(value)
  }
  const { lang, sourceType } = file ? getLang(file) : { lang: language }
  const filename = file ?? `parseport${getExtname(lang, sourceType)}`
  const result = await parse(filename, code, {
    lang: lang as never,
    sourceType,
  })
  if (result.errors.length) {
    throw new Error(result.errors.map(error => error.message).join('\n'))
  }
  return result.program
}

export async function parseportCode(code: string, options?: ParseportOptions) {
  const parser = options?.parser ?? defaultParser
  const lang = options?.lang ?? (options?.file ? getLang(options.file).lang : undefined)
  let ast: ParseportNode
  try {
    ast = await parser(code, options?.file, lang)
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  if (isEvaluatedNode(ast)) {
    return { value: ast.value }
  }
  const transformer = options?.transformer ?? parseportNode
  return transformer(ast, {
    ...options,
    code,
  })
}

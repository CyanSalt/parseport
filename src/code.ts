import type { Node } from '@babel/types'
import { babelParse, getLang } from 'ast-kit'
import { parseportNode } from './node'
import { PARSEPORT_UNKNOWN } from './reflect'
import type { ParseportOptions } from './types'

const PARSEPORT_EVALUATED = Symbol('PARSEPORT_EVALUATED')

interface ParseportEvaluatedNode {
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

export const defaultParser: ParseportParser = (code, file, lang) => {
  if (lang === 'json') {
    const value = JSON.parse(code)
    return createEvaluatedNode(value)
  }
  return babelParse(code, lang)
}

export async function parseportCode(code: string, options?: ParseportOptions) {
  const parser = options?.parser ?? defaultParser
  const lang = options?.lang ?? (options?.file ? getLang(options.file) : undefined)
  let ast: ParseportNode
  try {
    ast = await parser(code, options?.file, lang)
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  if (isEvaluatedNode(ast)) {
    return { value: ast.value }
  }
  return parseportNode(ast, options)
}

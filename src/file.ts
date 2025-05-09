import fs from 'node:fs'
import { parseportCode } from './code'
import { PARSEPORT_UNKNOWN } from './reflect'
import type { ParseportOptions } from './types'

export type ParseportLoader = (file: string) => string | Promise<string>

export const defaultLoader: ParseportLoader = file => {
  return fs.promises.readFile(file, 'utf-8')
}

export async function parseportFile(file: string, options?: ParseportOptions) {
  const loader = options?.loader ?? defaultLoader
  let code: string
  try {
    code = await loader(file)
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  return parseportCode(code, {
    ...options,
    file,
  })
}

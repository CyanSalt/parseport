import fs from 'node:fs'
import { parseportCode } from './code'
import type { ParseportOptions } from './options'

export type ParseportLoader = (file: string) => string | Promise<string>

const defaultLoader: ParseportLoader = file => {
  return fs.promises.readFile(file, 'utf-8')
}

export async function parseportFile(file: string, options?: ParseportOptions) {
  const loader = options?.loader ?? defaultLoader
  const code = await loader(file)
  return parseportCode(code, {
    ...options,
    file,
  })
}

import { createRequire } from 'node:module'
import { parseportFile } from './file'
import { PARSEPORT_UNKNOWN } from './node'
import type { ParseportOptions } from './types'

export type ParseportImportMeta = ImportMeta | { filename: string | undefined }

export type ParseportResolver = (file: string, meta: ParseportImportMeta) => string | Promise<string>

export const defaultResolver: ParseportResolver = (file, meta) => {
  if ('resolve' in meta) {
    return meta.resolve(file)
  }
  if ('url' in meta) {
    const require = createRequire((meta as ImportMeta).url)
    return require.resolve(file)
  }
  if (meta.filename) {
    const require = createRequire(meta.filename)
    return require.resolve(file)
  }
  throw new Error('Either "meta" or "file" is required in default resolver.')
}

export async function parseport(file: string, options?: ParseportOptions) {
  const resolver = options?.resolver ?? defaultResolver
  let absolutePath: string
  try {
    absolutePath = await resolver(file, options?.meta ?? { filename: options?.file })
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  return parseportFile(absolutePath, options)
}

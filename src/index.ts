import { createRequire } from 'node:module'
import { parseportCode } from './code'
import type { ParseportLoader } from './file'
import { parseportFile } from './file'
import { parseportNode } from './node'
import type { ParseportOptions } from './options'

export type ParseportImportMeta = ImportMeta | { filename: string | undefined }

export type ParseportResolver = (file: string, meta: ParseportImportMeta) => string | Promise<string>

const defaultResolver: ParseportResolver = (file, meta) => {
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
  const absolutePath = await resolver(file, options?.meta ?? { filename: options?.file })
  return parseportFile(absolutePath, options)
}

export type {
  ParseportOptions,
  ParseportLoader,
}

export {
  parseportFile,
  parseportCode,
  parseportNode,
}

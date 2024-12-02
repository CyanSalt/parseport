import { createRequire } from 'node:module'
import path from 'node:path'
import { ResolverFactory } from 'oxc-resolver'
import { parseportFile } from './file'
import { PARSEPORT_UNKNOWN } from './node'
import type { ParseportOptions } from './types'

export type ParseportImportMeta = ImportMeta | { filename: string | undefined }

export type ParseportResolver = (file: string, meta: ParseportImportMeta) => string | Promise<string>

export const defaultResolver: ParseportResolver = async (file, meta) => {
  if (meta.filename) {
    const directory = path.dirname(meta.filename)
    const factory = new ResolverFactory({
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    })
    const result = await factory.async(directory, file)
    if (result.error) {
      throw new Error(result.error)
    }
    return result.path!
  }
  if ('resolve' in meta) {
    return meta.resolve(file)
  }
  if ('url' in meta) {
    const require = createRequire((meta as ImportMeta).url)
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

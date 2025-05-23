import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ResolverFactory } from 'oxc-resolver'
import { parseportFile } from './file'
import { PARSEPORT_UNKNOWN } from './reflect'
import type { ParseportOptions } from './types'

export interface ParseportDeepImportMeta {
  filename: string | undefined,
  dirname: string | undefined,
  url: string | undefined,
}

export type ParseportImportMeta = ImportMeta | ParseportDeepImportMeta

export type ParseportResolver = (file: string, meta: ParseportImportMeta) => string | Promise<string>

export const defaultResolver: ParseportResolver = async (file, meta) => {
  let directory: string | undefined
  if (meta.dirname) {
    directory = meta.dirname
  } else if (meta.filename) {
    directory = path.dirname(meta.filename)
  }
  if (directory) {
    const factory = new ResolverFactory({
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    })
    const result = await factory.async(directory, file)
    if (result.error) {
      throw new Error(result.error)
    }
    return result.path!
  }
  throw new Error('Either "meta" or "file" is required in default resolver.')
}

export const nodeResolver: ParseportResolver = async (file, meta) => {
  if ('resolve' in meta) {
    return meta.resolve(file)
  }
  if (meta.url) {
    const require = createRequire(meta.url)
    return require.resolve(file)
  }
  throw new Error('Either "meta" or "file" is required in Node resolver.')
}

function createImportMeta(file: string | undefined): ParseportDeepImportMeta {
  return {
    filename: file,
    dirname: file === undefined ? undefined : path.dirname(file),
    url: file === undefined ? undefined : pathToFileURL(file).href,
  }
}

export async function parseport(file: string, options?: ParseportOptions) {
  const resolver = options?.resolver ?? defaultResolver
  let absolutePath: string
  try {
    absolutePath = await resolver(file, options?.meta ?? createImportMeta(options?.file))
  } catch {
    return { value: PARSEPORT_UNKNOWN }
  }
  return parseportFile(absolutePath, options)
}

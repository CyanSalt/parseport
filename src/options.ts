import type { ParseportParser } from './code'
import type { ParseportLoader } from './file'
import type { ParseportResolver } from './index'

export interface ParseportOptions {
  meta?: ImportMeta,
  deep?: boolean,
  resolver?: ParseportResolver,
  loader?: ParseportLoader,
  parser?: ParseportParser,
  context?: Record<string, unknown>,
  /** Injected by `parseportFile` */
  file?: string,
}

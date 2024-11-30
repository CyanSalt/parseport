import type { ParseportParser } from './code'
import type { ParseportLoader } from './file'
import type { ParseportResolver } from './index'

export interface ParseportOptions {
  /**
   * Module metadata where parseporting files
   */
  meta?: ImportMeta,
  /**
   * Transformer who make id -> file
   */
  resolver?: ParseportResolver,
  /**
   * Transformer who make file -> code
   */
  loader?: ParseportLoader,
  /**
   * Transformer who make code -> node
   */
  parser?: ParseportParser,
  /**
   * Source file language
   * Could be detected automatically from the file name
   */
  lang?: string,
  /**
   * Absolute path of the source file
   * Injected by `parseportFile`
   */
  file?: string,
  /**
   * Whether to parseport modules in the source file
   */
  deep?: boolean,
  /**
   * Definitions for unknown identifiers
   */
  context?: Record<string, unknown>,
}

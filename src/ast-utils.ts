import type { ObjectPropertyLike } from 'ast-kit'
import { resolveObjectKey } from 'ast-kit'

export function tryResolveObjectKey(property: ObjectPropertyLike) {
  try {
    return resolveObjectKey(property)
  } catch {
    return undefined
  }
}

export interface Constructor {
  new (...args: unknown[]): unknown,
}

export const PARSEPORT_UNKNOWN = Symbol('PARSEPORT_UNKNOWN')

const PARSEPORT_SAFE_SET = new WeakSet<WeakKey>()

export function isObject(value: unknown): value is object {
  return Boolean(value && (typeof value === 'object' || typeof value === 'function'))
}

export function markAsSafe(value: unknown) {
  if (isObject(value)) {
    PARSEPORT_SAFE_SET.add(value)
  }
  return value
}

export function isMarkedAsSafe(value: unknown) {
  if (isObject(value)) {
    return PARSEPORT_SAFE_SET.has(value)
  }
  // Primitives are always safe
  return true
}

export function get(target: {}, property: PropertyKey) {
  return isMarkedAsSafe(target) ? markAsSafe(target[property]) : target[property]
}

export function apply(target: Function, thisArg: unknown, args: unknown[]) {
  return isMarkedAsSafe(target) ? markAsSafe(target.call(thisArg, ...args)) : PARSEPORT_UNKNOWN
}

export function construct(target: Constructor, args: unknown[]) {
  return isMarkedAsSafe(target) ? markAsSafe(new target(...args)) : PARSEPORT_UNKNOWN
}

import path from 'node:path'
import { describe, expect, it, test } from 'vitest'
import { parseport, PARSEPORT_UNKNOWN, parseportCode, parseportFile } from '../src'

describe('parseport', () => {

  it('should work properly', async () => {
    const result = await parseport('./source/ts-module.ts', {
      meta: import.meta,
    })
    expect(result.value).toEqual({
      default: {
        name: 'ts-module',
        lang: 'ts',
        extra: PARSEPORT_UNKNOWN,
      },
    })
  })

  it('should be able to parse files recursively', async () => {
    const result = await parseport('./source/ts-module.ts', {
      meta: import.meta,
      deep: true,
    })
    expect(result.value).toEqual({
      default: {
        name: 'ts-module',
        lang: 'ts',
        extra: {
          flag: true,
        },
      },
    })
  })

})

describe('parseportFile', () => {

  it('should work properly', async () => {
    const result = await parseportFile(path.resolve(import.meta.dirname, './source/ts-module.ts'))
    expect(result.value).toEqual({
      default: {
        name: 'ts-module',
        lang: 'ts',
        extra: PARSEPORT_UNKNOWN,
      },
    })
  })

})

describe('parseportCode', () => {

  test('jsx syntax', async () => {
    const result = await parseportCode(
      `export const node = <></>`,
      { lang: 'jsx' },
    )
    expect(result.value).toEqual({
      node: PARSEPORT_UNKNOWN,
    })
  })

  test('ts syntax', async () => {
    const result = await parseportCode(
      `export const foo = {} as number`,
      { lang: 'ts' },
    )
    expect(result.value).toEqual({
      foo: {},
    })
  })

  test('ts import equals', async () => {
    const result = await parseportCode(
      `
      const bar = { value: 2 }
      import foo = bar
      export { foo }
      `,
      { lang: 'ts' },
    )
    expect(result.value).toEqual({
      foo: {
        value: 2,
      },
    })
  })

  test('ts import require', async () => {
    const result = await parseportCode(
      `
      import foo = require('./foo')
      export { foo }
      `,
      { lang: 'ts' },
    )
    expect(result.value).toEqual({
      foo: PARSEPORT_UNKNOWN,
    })
  })

  test('template string', async () => {
    const result = await parseportCode(
      `
      const value = 1
      export const address = \`No.\${value}, Foo St.\`
      `,
    )
    expect(result.value).toEqual({
      address: 'No.1, Foo St.',
    })
  })

  test('number', async () => {
    const result = await parseportCode(
      `export const value = 1`,
    )
    expect(result.value).toEqual({
      value: 1,
    })
  })

  test('string', async () => {
    const result = await parseportCode(
      `export const name = 'foo'`,
    )
    expect(result.value).toEqual({
      name: 'foo',
    })
  })

  test('boolean', async () => {
    const result = await parseportCode(
      `export const flag = true`,
    )
    expect(result.value).toEqual({
      flag: true,
    })
  })

  test('null', async () => {
    const result = await parseportCode(
      `export const data = null`,
    )
    expect(result.value).toEqual({
      data: null,
    })
  })

  test('regexp', async () => {
    const result = await parseportCode(
      `export const pattern = /^abc[def]/g`,
    )
    expect(result.value).toEqual({
      pattern: expect.any(RegExp),
    })
    const value = result.value as { pattern: RegExp }
    expect(value.pattern).toMatchObject({
      source: '^abc[def]',
      flags: 'g',
      global: true,
    })
  })

  test('array', async () => {
    const result = await parseportCode(
      `export const list = [2, 3, 3]`,
    )
    expect(result.value).toEqual({
      list: [2, 3, 3],
    })
  })

  test('array spreading', async () => {
    const result = await parseportCode(
      `
      const foo = [1]
      export const list = [, 2, 3, ...foo, 3]
      `,
    )
    expect(result.value).toEqual({
      // eslint-disable-next-line no-sparse-arrays
      list: [, 2, 3, 1, 3],
    })
  })

  test('arrow function, await and return', async () => {
    const result = await parseportCode(
      `
      let foo = 42
      export const fn = async () => {
        const value = await foo
        return value
      }
      `,
    )
    expect(result.value).toEqual({
      fn: expect.any(Function),
    })
    const value = result.value as { fn: () => unknown }
    await expect(value.fn()).resolves.toBe(42)
  })

  test('assignment', async () => {
    const result = await parseportCode(
      `
      let foo = 42
      let bar = foo /= 6
      export default bar
      `,
    )
    expect(result.value).toEqual({
      default: 7,
    })
  })

  test('binary', async () => {
    const result = await parseportCode(
      `export const value = 2 ** 3 * (4 + 5)`,
    )
    expect(result.value).toEqual({
      value: 72,
    })
  })

  test('logical', async () => {
    const result = await parseportCode(
      `export const value = null ?? (true || false)`,
    )
    expect(result.value).toEqual({
      value: true,
    })
  })

  test('function call and dynamic import', async () => {
    const result = await parseportCode(
      `
      const list = [2, 3, () => import('foo')]
      let fn = () => list
      export default fn()
      export const foo = list[2]?.()
      `,
    )
    expect(result.value).toEqual({
      default: [2, 3, expect.any(Function)],
      foo: expect.any(Promise),
    })
  })

  test('class', async () => {
    const result = await parseportCode(
      `export class Foo {}`,
    )
    expect(result.value).toEqual({
      Foo: expect.any(Function),
    })
  })

  test('ternary', async () => {
    const result = await parseportCode(
      `export const value = 1 ? 2 : 3`,
    )
    expect(result.value).toEqual({
      value: 2,
    })
  })

  test('export from', async () => {
    const result = await parseportCode(
      `
      export * as bar from 'bar'
      export { default, foo as oof } from 'bar'
      `,
      {
        modules: {
          bar: {
            default: false,
            foo: 97,
          },
        },
      },
    )
    expect(result.value).toEqual({
      bar: {
        default: false,
        foo: 97,
      },
      default: false,
      oof: 97,
    })
  })

  test('function', async () => {
    const result = await parseportCode(
      `
      export function fn () {
        return 42
      }
      `,
    )
    expect(result.value).toEqual({
      fn: expect.any(Function),
    })
    const value = result.value as { fn: () => unknown }
    expect(value.fn()).toBe(42)
  })

  test('object method', async () => {
    const result = await parseportCode(
      `
      export default {
        fn() {
          return 43
        }
      }
      `,
    )
    expect(result.value).toEqual({
      default: {
        fn: expect.any(Function),
      },
    })
    const value = result.value as { default: { fn: () => unknown } }
    expect(value.default.fn()).toBe(43)
  })

  test('variable', async () => {
    const result = await parseportCode(
      `
      export const foo = undefined
      export const bar = Infinity
      export const baz = Date
      export const qux = myself
      `,
      {
        variables: {
          myself: 'good boy',
        },
      },
    )
    expect(result.value).toEqual({
      foo: undefined,
      bar: Infinity,
      baz: Date,
      qux: 'good boy',
    })
  })

  test('member', async () => {
    const result = await parseportCode(
      `
      export default Array.prototype.length
      export const evil = Object.prototype?.eval
      `,
    )
    expect(result.value).toEqual({
      default: 0,
      evil: undefined,
    })
  })

  test('object', async () => {
    const result = await parseportCode(
      `
      export const data = {
        name: 'foo',
        age: 18,
      }
      `,
    )
    expect(result.value).toEqual({
      data: {
        name: 'foo',
        age: 18,
      },
    })
  })

  test('object spreading', async () => {
    const result = await parseportCode(
      `
      const foo = {
        pro: true,
      }
      export const data = {
        name: 'foo',
        ...foo,
        age: 18,
      }
      `,
    )
    expect(result.value).toEqual({
      data: {
        name: 'foo',
        pro: true,
        age: 18,
      },
    })
  })

  test('sequence', async () => {
    const result = await parseportCode(
      `export default (1, 2, 3)`,
    )
    expect(result.value).toEqual({
      default: 3,
    })
  })

  test('tagged template string', async () => {
    const result = await parseportCode(
      `export const text = tag\`a\${1}b\${2}c\``,
      {
        variables: {
          tag: (strings: TemplateStringsArray, ...values: unknown[]) => {
            return { strings, values }
          },
        },
      },
    )
    expect(result.value).toEqual({
      text: {
        strings: ['a', 'b', 'c'],
        values: [1, 2],
      },
    })
  })

  test('unary', async () => {
    const result = await parseportCode(
      `export const len = -[2].length`,
    )
    expect(result.value).toEqual({
      len: -1,
    })
  })

})

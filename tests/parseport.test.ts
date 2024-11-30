import { describe, expect, it } from 'vitest'
import { parseport, parseportCode } from '../src'

describe('parseport', () => {

  it('should work properly', async () => {
    const result = await parseport('./source/ts-module.ts', {
      meta: import.meta,
    })
    expect(result.value).toEqual({
      default: {
        name: 'ts-module',
        lang: 'ts',
      },
    })
  })

})

describe('parseportCode', () => {

  it('should work properly', async () => {
    const result = await parseportCode(
      'export const foo = 2 + [1, 3].length as never',
      { lang: 'ts' },
    )
    expect(result.value).toEqual({
      foo: 4,
    })
  })

})

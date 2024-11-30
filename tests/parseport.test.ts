import { describe, expect, it } from 'vitest'
import { parseport } from '../src'

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

# parseport

[![npm](https://img.shields.io/npm/v/parseport.svg)](https://www.npmjs.com/package/parseport)

Get static value from a JavaScript or TypeScript file.

## Usage

```ts
import { parseport } from 'parseport'

const { value } = await parseport('./file', { meta: import.meta })
```

Or use more basic functions:

```ts
import {
  parseportFile,
  parseportCode,
  parseportNode,
} from 'parseport'

await parseportFile('/path/to/file', { meta: import.meta }) // { value: ... }

await parseportCode('export default 2 + [1, 3].length as never', { lang: 'ts' }) // { value: { default: 4 } }

await parseportNode(babelNode) // { value: ... }
```

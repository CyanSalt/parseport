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

await parseportFile('/path/to/file') // { value: ... }

await parseportCode('export default 2 + [1, 3].length as never', { lang: 'ts' }) // { value: { default: 4 } }

await parseportNode(babelNode) // { value: ... }
```

### Resolving

You can customize the module resolving process with `resolver`.

```ts
const { value } = await parseport('./file', {
  meta: import.meta,
  resolver: (file, meta) => {
    // ...
  },
})
```

Parseport will use [`oxc-resolver`](https://github.com/oxc-project/oxc-resolver) to resolve modules by default. You can also use `nodeResolver` with Node.js `require()` machinery, but it may not work as expected when handling modules such as suffix-free.

```ts
import { nodeResolver } from 'parseport'

await parseport('./file', {
  meta: import.meta,
  resolver: nodeResolver,
})
```

In most cases, the `meta` accepted by `resolver` is `ImportMeta`, and it will be a mock meta object about the source file when traversing deeply.

`resolver` should return a target file path synchronously or asynchronously. Parseport will mark the file value as `PARSEPORT_UNKNOWN` when `resolver` throws, so you can safely use errors to handle modules you cannot resolve.

It can be roughly considered that `resolver` transforms the first argument of `parseport` into the first argument of `parseportFile`.

### Loading

You can customize the file loading process through `loader`.

```ts
const { value } = await parseport('./file', {
  meta: import.meta,
  load: file => {
    // ...
  },
})
```

Parseport will use the `fs` module in Node.js to load file contents by default.

`loader` accepts the absolute path of a file and returns the **text** content of the file synchronously or asynchronously. Similar to `resolver`, parseport will also mark the value of the file as `PARSEPORT_UNKNOWN` when `loader` throws.

It can be roughly considered that `loader` transforms the first argument of `parseportFile` into the first argument of `parseportCode`.

### Parsing

You can customize the code parsing process through `parser`.

```ts
const { value } = await parseport('./file', {
  meta: import.meta,
  parser: (code, file, lang) => {
    // ...
  },
})
```

Parseport will choose different Babel configurations based on `lang`, which will be automatically inferred from `file` when left empty.

`loader` accepts the text content of the file and returns the `Program` node of the Babel AST synchronously or asynchronously. Similarly, thrown in `parser` will also result in `PARSEPORT_UNKNOWN`.

It can be roughly considered that `parser` transforms the first argument of `parseportCode` and the first argument of `parseportFile` into the first argument of `parseportNode`.

### Traversing

There are three options that may affect the AST traversal behavior.

- `deep`: When `true`, module declarations will also call `parseport` recursively to get the imported values; otherwise these values ​​will all be `PARSEPORT_UNKNOWN`.

- `variables`: This object can be used to declare variables that you want to replace. This is helpful for situations where you want to handle certain values ​​in a limited runtime way. e.g:

```ts
const { value } = await parseportCode(`
  import { head } from 'lodash'

  export default head([1, 2])
`, {
  meta: import.meta,
  variables: {
    head: array => array[0],
  },
})
```

- `modules`: Similar to `variables`, this object can be used to declare modules that you want to replace. The above code is equivalent to the following code:

```ts
const { value } = await parseportCode(`
  import { head } from 'lodash'

  export default head([1, 2])
`, {
  meta: import.meta,
  modules: {
    lodash: {
      head: array => array[0],
    },
  },
})
```

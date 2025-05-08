# parseport

[![npm](https://img.shields.io/npm/v/parseport.svg)](https://www.npmjs.com/package/parseport)

Get static value from a JavaScript or TypeScript file.

```ts
// my-module.ts
export const name = 'my-module'

export default function () {
  return `My name is "${name}"`
}
```

```ts
// another-file.ts
import { parseport } from 'parseport'

const { value } = await parseport('./file', { meta: import.meta })

value.name // 'my-module'
value.default() // 'My name is "my-module"'
```

> [!NOTE]
> Parseport is NOT an evaluator. Actually, it only analyzes JS/TS module exports. This means that the following code will not be evaluated correctly (instead, it evaluates to a function that always returns a fixed value):
> ```js
> export let name = 'my-module'
>
> export default function () {
>   name = 'still ' + name
>   return `My name is "${name}"`
> }
> ```

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
  loader: file => {
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

`parser` also provides integration capabilities with non-JavaScript/TypeScript syntax. For example, you can combine custom parser with the built-in parser.

```ts
import { defaultParser, parseport } from 'parseport'

const { value } = await parseport('./file', {
  meta: import.meta,
  parser: (code, file, lang) => {
    if (lang === 'my-lang') {
      const ast = parseMyLang(code)
      return ast
    }
    return defaultParser(code, file, lang)
  },
})
```

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

For example, `parseport` does not execute any unknown functions that not declared in `variables` and `modules` by default. If you want to get the result of some built-in function (such as `Object.assign`), you can add it to `variables`:

```ts
const { value } = await parseportCode(`
  const defaultValue = { bar: false }

  export default Object.assign({ foo: true }, defaultValue)
`, {
  meta: import.meta,
  variables: {
    Object,
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

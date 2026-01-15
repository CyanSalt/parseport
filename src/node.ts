import type { BinaryExpression, Declaration, Expression, LogicalExpression, MemberExpression, Node, Statement, UnaryExpression, UpdateExpression } from '@babel/types'
import { isExpression, isFlow, isIdentifier, isJSX, isLiteral, isTypeScript } from '@babel/types'
import type { ObjectPropertyLike } from 'ast-kit'
import { resolveLiteral, resolveString } from 'ast-kit'
import globals from 'globals'
import { tryResolveObjectKey } from './ast-utils'
import type { Constructor } from './reflect'
import { apply, construct, get, isMarkedAsSafe, markAsSafe, PARSEPORT_UNKNOWN } from './reflect'
import type { Scope } from './scope'
import { analyzeScopes, resolveReferences } from './scope'
import type { ParseportOptions, ParseportResult } from './types'
import { parseport } from '.'

const PARSEPORT_RELATED_MAP = new WeakMap<WeakKey, unknown>()

export async function parseportNode(node: Node, options?: ParseportOptions) {
  const values = new Map()
  const scopes = analyzeScopes(node)
  return evaluateNode(node, values, scopes, options)
}

function isObject(value: unknown): value is object {
  return Boolean(value && (typeof value === 'object' || typeof value === 'function'))
}

function attachRelated(value: unknown, related: unknown) {
  if (isObject(value)) {
    PARSEPORT_RELATED_MAP.set(value, related)
  }
  return value
}

function extractRelated(value: unknown) {
  if (isObject(value)) {
    return PARSEPORT_RELATED_MAP.has(value) ? PARSEPORT_RELATED_MAP.get(value) : PARSEPORT_UNKNOWN
  }
  return PARSEPORT_UNKNOWN
}

async function evaluateNode(
  node: Node,
  values: Map<Node, unknown>,
  scopes: Map<Node, Scope>,
  options?: ParseportOptions,
): Promise<ParseportResult> {
  if (values.has(node)) {
    return { value: values.get(node) }
  }
  const { value } = await analyzeNode(node, values, scopes, options)
  values.set(node, value)
  return { value }
}

function callUnary(value: unknown, operator: (value: unknown) => unknown) {
  if (value === PARSEPORT_UNKNOWN) return PARSEPORT_UNKNOWN
  return operator(value)
}

function callBinary(a: unknown, b: unknown, operator: (a: unknown, b: unknown) => unknown) {
  if (a === PARSEPORT_UNKNOWN || b === PARSEPORT_UNKNOWN) return PARSEPORT_UNKNOWN
  return operator(a, b)
}

type UnaryOperator = UnaryExpression['operator'] | UpdateExpression['operator']
type CalculationOperator = '+' | '-' | '/' | '%' | '*' | '**' | '&' | '|' | '>>' | '>>>' | '<<' | '^'
type BinaryOperator = BinaryExpression['operator'] | LogicalExpression['operator']
type AssignmentOperator = `${CalculationOperator | LogicalExpression['operator']}=`

/* eslint-disable no-implicit-coercion, no-bitwise */
function getUnaryOperator(operator: UnaryOperator, prefix: boolean) {
  switch (operator) {
    case 'void':
      return (value: any) => void value
    case '+':
      return (value: any) => +value
    case '-':
      return (value: any) => -value
    case '!':
      return (value: any) => !value
    case '~':
      return (value: any) => ~value
    case 'typeof':
      return (value: any) => typeof value
    case '++':
      return (value: any) => (prefix ? value + (typeof value === 'bigint' ? 1n : 1) : value)
    case '--':
      return (value: any) => (prefix ? value - ((typeof value === 'bigint' ? 1n : 1) as never) : value)
    case 'throw':
    case 'delete':
    default:
      return PARSEPORT_UNKNOWN
  }
}
/* eslint-enable no-implicit-coercion */

/* eslint-disable no-bitwise, eqeqeq */
function getBinaryOperator(operator: BinaryOperator | AssignmentOperator) {
  switch (operator) {
    case '+':
    case '+=':
      return (a: any, b: any) => a + b
    case '-':
    case '-=':
      return (a: any, b: any) => a - b
    case '/':
    case '/=':
      return (a: any, b: any) => a / b
    case '%':
    case '%=':
      return (a: any, b: any) => a / b
    case '*':
    case '*=':
      return (a: any, b: any) => a * b
    case '**':
    case '**=':
      return (a: any, b: any) => a ** b
    case '&':
    case '&=':
      return (a: any, b: any) => a & b
    case '|':
    case '|=':
      return (a: any, b: any) => a | b
    case '>>':
    case '>>=':
      return (a: any, b: any) => a >> b
    case '>>>':
    case '>>>=':
      return (a: any, b: any) => a >>> b
    case '<<':
    case '<<=':
      return (a: any, b: any) => a << b
    case '^':
    case '^=':
      return (a: any, b: any) => a ^ b
    case '==':
      return (a: any, b: any) => a == b
    case '===':
      return (a: any, b: any) => a === b
    case '!=':
      return (a: any, b: any) => a != b
    case '!==':
      return (a: any, b: any) => a !== b
    case 'in':
      return (a: any, b: any) => a in b
    case 'instanceof':
      return (a: any, b: any) => a instanceof b
    case '>':
      return (a: any, b: any) => a > b
    case '<':
      return (a: any, b: any) => a < b
    case '>=':
      return (a: any, b: any) => a >= b
    case '<=':
      return (a: any, b: any) => a <= b
    case '||':
    case '||=':
      return (a: any, b: any) => a || b
    case '&&':
    case '&&=':
      return (a: any, b: any) => a && b
    case '??':
    case '??=':
      return (a: any, b: any) => a ?? b
    // Proposal: pipeline operator
    case '|>':
      return (a: any, b: any) => b(a)
    default:
      return PARSEPORT_UNKNOWN
  }
}
/* eslint-enable no-bitwise, eqeqeq */

function getDeclarationName(declaration: Declaration) {
  return 'id' in declaration && declaration.id
    ? resolveString(declaration.id)
    : undefined
}

function createHelpers(
  values: Map<Node, unknown>,
  scopes: Map<Node, Scope>,
  options?: ParseportOptions,
) {
  const evaluate = (childNode: Node) => evaluateNode(childNode, values, scopes, options)
  const parseportDeep = async (source: string) => {
    if (options?.modules && source in options.modules) {
      const definition = options.modules[source]
      return {
        value: markAsSafe(await (
          typeof definition === 'function' ? definition() : definition
        )),
      }
    }
    if (options?.deep) {
      return parseport(source, { ...options, meta: undefined })
    } else {
      return { value: PARSEPORT_UNKNOWN }
    }
  }
  const evaluateReference = async (currentNode: Node, name: string) => {
    if (options?.variables && name in options.variables) {
      return {
        value: markAsSafe(options.variables[name]),
      }
    }
    const scope = scopes.get(currentNode)
    const reference = scope ? scope.get(name) : null
    if (!reference) {
      if (name in globalThis && name in globals.builtin) {
        return {
          value: globalThis[name],
        }
      }
      return {
        value: PARSEPORT_UNKNOWN,
      }
    }
    const { init, paths } = reference
    if (!init) return { value: PARSEPORT_UNKNOWN }
    const { value: initialValue } = await evaluate(init)
    return {
      value: paths.reduce<unknown>((value, visitor) => {
        if (value === PARSEPORT_UNKNOWN) return PARSEPORT_UNKNOWN
        try {
          return visitor(value)
        } catch {
          return PARSEPORT_UNKNOWN
        }
      }, initialValue),
    }
  }
  const emulate = async (
    callee: Function,
    lazyThisArg: (() => ParseportResult | Promise<ParseportResult>) | Node | undefined,
    lazyArgs: ((() => ParseportResult | Promise<ParseportResult>) | Node)[],
    reflection: 'apply' | 'construct',
  ) => {
    if (isMarkedAsSafe(callee)) {
      const [thisArg, ...args] = await Promise.all([
        typeof lazyThisArg === 'function' ? lazyThisArg() : (lazyThisArg ? evaluate(lazyThisArg) : { value: undefined }),
        ...lazyArgs.map(argument => (typeof argument === 'function' ? argument() : evaluate(argument))),
      ])
      return {
        value: reflection === 'construct'
          ? construct(callee as Constructor, args.map(arg => arg.value))
          : apply(callee, thisArg.value, args.map(arg => arg.value)),
      }
    }
    return {
      value: extractRelated(callee),
    }
  }
  const evaluateProperty = async (
    object: {},
    propertyNode: MemberExpression['property'],
    computed: boolean,
  ) => {
    if (computed) {
      const { value: property } = await evaluate(propertyNode)
      if (property === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      return {
        value: get(object, property as PropertyKey),
      }
    } else {
      if (isIdentifier(propertyNode) || isLiteral(propertyNode)) {
        const property = resolveString(propertyNode)
        return {
          value: get(object, property),
        }
      } else {
        return {
          value: PARSEPORT_UNKNOWN,
        }
      }
    }
  }
  const evaluateExports = async (body: Statement[]) => {
    const exportStatements = body.filter(stmt => {
      return stmt.type === 'ExportAllDeclaration'
        || stmt.type === 'ExportDefaultDeclaration'
        || stmt.type === 'ExportNamedDeclaration'
        || stmt.type === 'TSExportAssignment'
    })
    const chunks = await Promise.all(exportStatements.map(stmt => evaluate(stmt)))
    return {
      value: chunks.reduce<{}>((exports, { value }) => {
        return { ...exports, ...(value === PARSEPORT_UNKNOWN ? {} : value as {}) }
      }, {}),
    }
  }
  return {
    evaluate,
    parseportDeep,
    evaluateReference,
    emulate,
    evaluateProperty,
    evaluateExports,
  }
}

async function analyzeNode(
  node: Node,
  values: Map<Node, unknown>,
  scopes: Map<Node, Scope>,
  options?: ParseportOptions,
): Promise<ParseportResult> {
  const {
    evaluate,
    parseportDeep,
    evaluateReference,
    emulate,
    evaluateProperty,
    evaluateExports,
  } = createHelpers(values, scopes, options)
  if (isJSX(node)) {
    return { value: PARSEPORT_UNKNOWN }
  }
  if (isTypeScript(node) || isFlow(node)) {
    if (isExpression(node)) {
      return evaluate(node.expression)
    }
    switch (node.type) {
      case 'TSEnumDeclaration': {
        const chunks = await Promise.all(node.members.map(member => {
          return Promise.all([
            member.initializer ? evaluate(member.initializer) : undefined,
            resolveString(member.id),
          ])
        }))
        let value: Record<string, number> & Record<number, string> = {}
        let current = 0
        for (const [init, name] of chunks) {
          if (init) {
            current = init.value as number
          }
          value[current] = name
          value[name] = current
          current = typeof current === 'number' ? current + 1 : undefined as never
        }
        return { value }
      }
      case 'TSExternalModuleReference':
        return parseportDeep(node.expression.value)
      case 'TSImportEqualsDeclaration':
        return evaluate(node.moduleReference)
      case 'TSModuleBlock':
        return evaluateExports(node.body)
      case 'TSModuleDeclaration':
        return evaluate(node.body)
      default:
        return { value: PARSEPORT_UNKNOWN }
    }
  }
  if (isLiteral(node)) {
    if (node.type === 'TemplateLiteral') {
      const expressions = await Promise.all(
        (node.expressions as Expression[]).map(expr => evaluate(expr)),
      )
      return {
        value: node.quasis.reduce((full, part, index) => {
          const expression = expressions[index]
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (expression) {
            return full + part.value.cooked + expression.value
          }
          return full + part.value.cooked
        }, ''),
      }
    }
    return {
      value: resolveLiteral(node),
    }
  }
  switch (node.type) {
    case 'ArrayExpression': {
      const elements = await Promise.all(node.elements.map(async element => {
        return Promise.all([
          // eslint-disable-next-line no-sparse-arrays
          element === null ? Promise.resolve({ value: [,] }) : evaluate(element),
          element === null || element.type === 'SpreadElement',
        ])
      }))
      let value: unknown[] = []
      for (const [{ value: element }, shouldSpread] of elements) {
        if (shouldSpread) {
          if (element !== PARSEPORT_UNKNOWN) {
            value = value.concat(element)
          }
        } else {
          value.push(element)
        }
      }
      return { value }
    }
    case 'ArrowFunctionExpression': {
      // TODO: generator
      const { value: body } = await evaluate(node.body)
      return {
        value: node.async
          ? attachRelated(async () => body, attachRelated(Promise.resolve(body), body))
          : attachRelated(() => body, body),
      }
    }
    case 'AssignmentExpression': {
      if (node.operator === '=') {
        return evaluate(node.right)
      }
      const operator = getBinaryOperator(node.operator as AssignmentOperator)
      if (operator === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      const [{ value: left }, { value: right }] = await Promise.all([
        evaluate(node.left),
        evaluate(node.right),
      ])
      return { value: callBinary(left, right, operator) }
    }
    case 'AwaitExpression': {
      const { value } = await evaluate(node.argument)
      if (value === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      if (
        value
        && typeof value === 'object'
        && 'then' in value
        && typeof value.then === 'function'
      ) {
        return {
          value: extractRelated(value),
        }
      }
      return { value }
    }
    case 'BinaryExpression':
    case 'LogicalExpression': {
      const operator = getBinaryOperator(node.operator)
      if (operator === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      const [{ value: left }, { value: right }] = await Promise.all([
        evaluate(node.left),
        evaluate(node.right),
      ])
      return { value: callBinary(left, right, operator) }
    }
    case 'BlockStatement': {
      const firstReturnStatement = node.body.find(stmt => {
        return stmt.type === 'ReturnStatement'
          || stmt.type === 'ThrowStatement'
      })
      if (!firstReturnStatement || firstReturnStatement.type === 'ThrowStatement') return { value: PARSEPORT_UNKNOWN }
      return evaluate(firstReturnStatement)
    }
    case 'CallExpression': {
      // Dynamic import
      if (node.callee.type === 'Import') {
        if (options?.deep) {
          const { value: source } = await evaluate(node.arguments[0])
          if (typeof source === 'string') {
            return parseportDeep(source)
          }
        }
        return { value: attachRelated(Promise.resolve(PARSEPORT_UNKNOWN), PARSEPORT_UNKNOWN) }
      }
      const { value: callee } = await evaluate(node.callee)
      if (typeof callee === 'function') {
        const thisArg = node.callee.type === 'MemberExpression'
          ? node.callee.object
          : undefined
        return emulate(callee, thisArg, node.arguments, 'apply')
      }
      return { value: PARSEPORT_UNKNOWN }
    }
    case 'ClassBody': {
      const chunks = await Promise.all(
        node.body
          .filter(property => property.type === 'ClassMethod' || property.type === 'ClassProperty')
          .filter(property => property.static)
          .map(async property => {
            return Promise.all([
              evaluate(property),
              tryResolveObjectKey(property as unknown as ObjectPropertyLike),
            ])
          }),
      )
      let value = class {}
      for (const [{ value: member }, name] of chunks) {
        if (name !== undefined) {
          value[name] = member
        }
      }
      return { value }
    }
    case 'ClassDeclaration':
    case 'ClassExpression': {
      return evaluate(node.body)
    }
    case 'ConditionalExpression': {
      const { value: test } = await evaluate(node.test)
      if (test === PARSEPORT_UNKNOWN) return { value: test }
      return test ? evaluate(node.consequent) : evaluate(node.alternate)
    }
    case 'EmptyStatement':
      return { value: undefined }
    case 'ExportAllDeclaration':
    case 'ImportDeclaration': {
      return parseportDeep(node.source.value)
    }
    case 'ExportDefaultDeclaration': {
      const { value } = await evaluate(node.declaration)
      return {
        value: { default: value },
      }
    }
    case 'ExportNamedDeclaration': {
      if (node.declaration) {
        if (node.declaration.type === 'VariableDeclaration') {
          const refs = node.declaration.declarations.flatMap(declarator => resolveReferences(declarator))
          const chunks = await Promise.all(refs.map(async ({ name }) => {
            const { value } = await evaluateReference(node, name)
            return { [name]: value }
          }))
          return {
            value: chunks.reduce((exports, chunk) => ({ ...exports, ...chunk }), {}),
          }
        }
        const name = getDeclarationName(node.declaration)
        const { value } = await evaluate(node.declaration)
        return {
          value: name ? { [name]: value } : {},
        }
      }
      if (node.source) {
        const { value } = await parseportDeep(node.source.value)
        return {
          value: Object.fromEntries(node.specifiers.map(specifier => {
            const name = resolveString(specifier.exported)
            switch (specifier.type) {
              case 'ExportNamespaceSpecifier':
                return [name, value]
              case 'ExportDefaultSpecifier':
                return [name, (value as { default: unknown }).default]
              case 'ExportSpecifier':
                return [name, (value as {})[resolveString(specifier.local)]]
              default:
                return [name, PARSEPORT_UNKNOWN]
            }
          })),
        }
      }
      const chunks = await Promise.all(node.specifiers.map<Promise<[string, unknown]>>(async specifier => {
        const name = resolveString(specifier.exported)
        switch (specifier.type) {
          case 'ExportSpecifier': {
            const { value } = await evaluate(specifier.local)
            return [name, value]
          }
          case 'ExportNamespaceSpecifier':
          case 'ExportDefaultSpecifier':
          default:
            return [name, PARSEPORT_UNKNOWN]
        }
      }))
      return {
        value: Object.fromEntries(chunks),
      }
    }
    case 'ExpressionStatement': {
      return evaluate(node.expression)
    }
    case 'File': {
      return evaluate(node.program)
    }
    case 'ClassMethod':
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ObjectMethod': {
      // TODO: generator
      const { value: body } = await evaluate(node.body)
      return {
        value: node.async
          ? attachRelated(
            async function () {
              return body
            },
            attachRelated(Promise.resolve(body), body),
          )
          : attachRelated(
            function () {
              return body
            },
            body,
          ),
      }
    }
    case 'Identifier': {
      return evaluateReference(node, node.name)
    }
    case 'MemberExpression': {
      const { value: object } = await evaluate(node.object)
      if (object === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      return evaluateProperty(object as {}, node.property, node.computed)
    }
    case 'NewExpression': {
      const { value: callee } = await evaluate(node.callee)
      if (typeof callee === 'function') {
        return emulate(callee, undefined, node.arguments, 'construct')
      }
      return { value: PARSEPORT_UNKNOWN }
    }
    case 'ObjectExpression': {
      const SPREAD = Symbol('...')
      const chunks = await Promise.all(node.properties.map(async property => {
        return Promise.all([
          evaluate(property),
          property.type === 'SpreadElement' ? SPREAD : tryResolveObjectKey(property),
        ])
      }))
      let value = {}
      for (const [{ value: member }, name] of chunks) {
        if (name === SPREAD) {
          if (member !== PARSEPORT_UNKNOWN) {
            Object.assign(value, member)
          }
        } else {
          if (name !== undefined) {
            value[name] = member
          }
        }
      }
      return { value }
    }
    case 'ClassProperty':
    case 'ObjectProperty': {
      return node.value ? evaluate(node.value) : { value: undefined }
    }
    case 'OptionalCallExpression': {
      const { value: callee } = await evaluate(node.callee)
      if (typeof callee === 'function') {
        const thisArg = node.callee.type === 'MemberExpression'
          ? node.callee.object
          : undefined
        return emulate(callee, thisArg, node.arguments, 'apply')
      }
      if (callee === undefined || callee === null) return { value: undefined }
      return { value: PARSEPORT_UNKNOWN }
    }
    case 'OptionalMemberExpression': {
      const { value: object } = await evaluate(node.object)
      if (object === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      if (object === undefined || object === null) return { value: undefined }
      return evaluateProperty(object, node.property, node.computed)
    }
    case 'Program': {
      return evaluateExports(node.body)
    }
    case 'ReturnStatement':
      return node.argument
        ? evaluate(node.argument)
        : { value: undefined }
    case 'SequenceExpression': {
      if (!node.expressions.length) return { value: PARSEPORT_UNKNOWN }
      return evaluate(node.expressions[node.expressions.length - 1])
    }
    case 'SpreadElement':
      return evaluate(node.argument)
    case 'TaggedTemplateExpression': {
      const { value: callee } = await evaluate(node.tag)
      if (typeof callee === 'function') {
        const thisArg = node.tag.type === 'MemberExpression'
          ? node.tag.object
          : undefined
        return emulate(callee, thisArg, [
          async () => {
            const quasis = await Promise.all(node.quasi.quasis.map(element => evaluate(element)))
            return {
              value: quasis.map(quasi => quasi.value),
            }
          },
          ...node.quasi.expressions,
        ], 'apply')
      }
      return { value: PARSEPORT_UNKNOWN }
    }
    case 'TemplateElement':
      return {
        value: node.value.cooked ?? node.value.raw,
      }
    case 'UnaryExpression':
    case 'UpdateExpression': {
      const operator = getUnaryOperator(node.operator, node.prefix)
      if (operator === PARSEPORT_UNKNOWN) return { value: PARSEPORT_UNKNOWN }
      const { value: argument } = await evaluate(node.argument)
      return { value: callUnary(argument, operator) }
    }
    default:
      return { value: PARSEPORT_UNKNOWN }
  }
}

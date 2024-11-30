import type { BinaryExpression, Declaration, Expression, LogicalExpression, Node, UnaryExpression } from '@babel/types'
import { isExpression, isFlow, isIdentifier, isJSX, isLiteral, isTypeScript } from '@babel/types'
import { resolveLiteral, resolveString } from 'ast-kit'
import globals from 'globals'
import { tryResolveObjectKey } from './ast-utils'
import type { ParseportOptions } from './options'
import type { Scope } from './scope'
import { analyzeScopes } from './scope'
import { parseport } from '.'

export interface ParseportNodeOptions extends ParseportOptions {
  values?: Map<Node, unknown>,
}

const UNKNOWN_VALUE = Symbol('UNKNOWN_VALUE')
const PARSEPORT_RELATED = Symbol('PARSEPORT_RELATED')
const PARSEPORT_SAFE = Symbol('PARSEPORT_SAFE')

export async function parseportNode(
  node: Node,
  options?: ParseportNodeOptions,
) {
  const values = options?.values ?? new Map()
  const scopes = analyzeScopes(node)
  return evaluateNode(node, values, scopes, options)
}

function attachRelated<T>(value: T, related: unknown) {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    value[PARSEPORT_RELATED] = related
  }
  return value
}

function markAsSafe<T>(value: T) {
  if (typeof value === 'function') {
    value[PARSEPORT_SAFE] = true
  }
  return value
}

async function evaluateNode(
  node: Node,
  values: Map<Node, unknown>,
  scopes: Map<Node, Scope>,
  options?: ParseportNodeOptions,
) {
  if (values.has(node)) {
    return { value: values.get(node) }
  }
  const { value } = await analyzeNode(node, values, scopes, options)
  values.set(node, value)
  return { value }
}

function callUnary(value: unknown, operator: (value: unknown) => unknown) {
  if (value === UNKNOWN_VALUE) return UNKNOWN_VALUE
  return operator(value)
}

function callBinary(a: unknown, b: unknown, operator: (a: unknown, b: unknown) => unknown) {
  if (a === UNKNOWN_VALUE || b === UNKNOWN_VALUE) return UNKNOWN_VALUE
  return operator(a, b)
}

type UnaryOperator = UnaryExpression['operator']
type CalculationOperator = '+' | '-' | '/' | '%' | '*' | '**' | '&' | '|' | '>>' | '>>>' | '<<' | '^'
type BinaryOperator = BinaryExpression['operator'] | LogicalExpression['operator']
type AssignmentOperator = `${CalculationOperator | LogicalExpression['operator']}=`

/* eslint-disable no-implicit-coercion, no-bitwise */
function getUnaryOperator(operator: UnaryOperator) {
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
    case 'throw':
    case 'delete':
    default:
      return UNKNOWN_VALUE
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
      return UNKNOWN_VALUE
  }
}
/* eslint-enable no-bitwise, eqeqeq */

function getDeclarationName(declaration: Declaration) {
  return 'id' in declaration && declaration.id
    ? resolveString(declaration.id)
    : undefined
}

async function analyzeNode(
  node: Node,
  values: Map<Node, unknown>,
  scopes: Map<Node, Scope>,
  options?: ParseportNodeOptions,
): Promise<{ value: unknown }> {
  const evaluate = (childNode: Node) => evaluateNode(childNode, values, scopes, options)
  const parseportDeep = (source: string) => {
    if (options?.deep) {
      return parseport(source, { ...options, meta: undefined })
    } else {
      return { value: UNKNOWN_VALUE }
    }
  }
  if (isJSX(node)) {
    return { value: UNKNOWN_VALUE }
  }
  if (isTypeScript(node) || isFlow(node)) {
    if (isExpression(node)) {
      return evaluate(node.expression)
    }
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (node.type) {
      case 'TSExternalModuleReference':
        return parseportDeep(node.expression.value)
      case 'TSImportEqualsDeclaration':
        return evaluate(node.moduleReference)
      default:
        return { value: UNKNOWN_VALUE }
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
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            return full + part.value.cooked + expression
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
          if (element !== UNKNOWN_VALUE) {
            value = value.concat(element)
          }
        } else {
          value.push(element)
        }
      }
      return { value }
    }
    case 'ObjectExpression': {
      const SPREAD = Symbol('...')
      const chunks = await Promise.all(node.properties.map(async property => {
        return Promise.all([
          property.type === 'SpreadElement' ? evaluate(property.argument) : evaluate(property),
          property.type === 'SpreadElement' ? SPREAD : tryResolveObjectKey(property),
        ])
      }))
      let value = {}
      for (const [{ value: member }, name] of chunks) {
        if (name === SPREAD) {
          if (member !== UNKNOWN_VALUE) {
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
    case 'ArrowFunctionExpression': {
      // TODO: generator
      const { value: body } = await evaluate(node.body)
      return {
        value: node.async
          ? attachRelated(async () => body, attachRelated(new Promise(() => {}), body))
          : attachRelated(() => body, body),
      }
    }
    case 'AssignmentExpression': {
      if (node.operator === '=') {
        return evaluate(node.right)
      }
      const operator = getBinaryOperator(node.operator as AssignmentOperator)
      if (operator === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
      const [{ value: left }, { value: right }] = await Promise.all([
        evaluate(node.left),
        evaluate(node.right),
      ])
      return { value: callBinary(left, right, operator) }
    }
    case 'AwaitExpression': {
      const { value } = await evaluate(node.argument)
      if (value === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
      if (
        value
        && typeof value === 'object'
        && 'then' in value
        && typeof value.then === 'function'
      ) {
        return {
          value: PARSEPORT_RELATED in value ? value[PARSEPORT_RELATED] : UNKNOWN_VALUE,
        }
      }
      return { value }
    }
    case 'BinaryExpression':
    case 'LogicalExpression': {
      const operator = getBinaryOperator(node.operator)
      if (operator === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
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
      if (!firstReturnStatement || firstReturnStatement.type === 'ThrowStatement') return { value: UNKNOWN_VALUE }
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
        return { value: UNKNOWN_VALUE }
      }
      const { value: callee } = await evaluate(node.callee)
      if (typeof callee === 'function') {
        if (PARSEPORT_RELATED in callee) {
          return {
            value: callee[PARSEPORT_RELATED],
          }
        }
        if (PARSEPORT_SAFE in callee && callee[PARSEPORT_SAFE]) {
          const args = await Promise.all(node.arguments.map(argument => evaluate(argument)))
          return {
            value: callee(...args.map(arg => arg.value)),
          }
        }
      }
      return { value: UNKNOWN_VALUE }
    }
    case 'ClassDeclaration':
    case 'ClassExpression': {
      return {
        value: class {},
      }
    }
    case 'ConditionalExpression': {
      const { value: test } = await evaluate(node.test)
      if (test === UNKNOWN_VALUE) return { value: test }
      return test ? evaluate(node.consequent) : evaluate(node.alternate)
    }
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
        const name = getDeclarationName(node.declaration)
        const value = await evaluate(node.declaration)
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
                return [name, (value as {})[resolveString(specifier.exported)]]
              default:
                return []
            }
          })),
        }
      }
      return { value: UNKNOWN_VALUE }
    }
    case 'ExpressionStatement': {
      return evaluate(node.expression)
    }
    case 'File': {
      return evaluate(node.program)
    }
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
            attachRelated(new Promise(() => {}), body),
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
      const scope = scopes.get(node)
      const reference = scope ? scope.get(node.name) : null
      if (!reference) {
        if (node.name in globalThis && globals.builtin[node.name]) {
          return {
            value: globalThis[node.name],
          }
        }
        if (options?.context && node.name in options.context) {
          return {
            value: markAsSafe(options.context[node.name]),
          }
        }
        return {
          value: UNKNOWN_VALUE,
        }
      }
      const { init, paths } = reference
      const { value: initialValue } = init ? await evaluate(init) : { value: UNKNOWN_VALUE }
      if (initialValue === UNKNOWN_VALUE) {
        if (options?.context && node.name in options.context) {
          return {
            value: markAsSafe(options.context[node.name]),
          }
        }
      }
      return {
        value: paths.reduce<unknown>((value, visitor) => {
          if (value === UNKNOWN_VALUE) return UNKNOWN_VALUE
          try {
            return visitor(value)
          } catch {
            return UNKNOWN_VALUE
          }
        }, initialValue),
      }
    }
    case 'MemberExpression': {
      const { value: object } = await evaluate(node.object)
      if (object === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
      if (node.computed) {
        const { value: property } = await evaluate(node.property)
        if (property === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
        return {
          value: (object as {})[property as PropertyKey],
        }
      } else {
        if (isIdentifier(node.property) || isLiteral(node.property)) {
          const property = resolveString(node.property)
          return {
            value: (object as {})[property],
          }
        } else {
          return {
            value: UNKNOWN_VALUE,
          }
        }
      }
    }
    case 'ObjectProperty':
      return evaluate(node.value)
    case 'OptionalCallExpression': {
      const { value: callee } = await evaluate(node.callee)
      if (typeof callee === 'function') {
        if (PARSEPORT_RELATED in callee) {
          return {
            value: callee[PARSEPORT_RELATED],
          }
        }
        if (PARSEPORT_SAFE in callee && callee[PARSEPORT_SAFE]) {
          const args = await Promise.all(node.arguments.map(argument => evaluate(argument)))
          return {
            value: callee(...args),
          }
        }
      }
      if (callee === undefined || callee === null) return { value: undefined }
      return { value: UNKNOWN_VALUE }
    }
    case 'OptionalMemberExpression': {
      const { value: object } = await evaluate(node.object)
      if (object === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
      if (object === undefined || object === null) return { value: undefined }
      if (node.computed) {
        const { value: property } = await evaluate(node.property)
        if (property === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
        return {
          value: (object as {})[property as PropertyKey],
        }
      } else {
        if (isIdentifier(node.property) || isLiteral(node.property)) {
          const property = resolveString(node.property)
          return {
            value: (object as {})[property],
          }
        } else {
          return {
            value: UNKNOWN_VALUE,
          }
        }
      }
    }
    case 'Program': {
      const exportStatements = node.body.filter(stmt => {
        return stmt.type === 'ExportAllDeclaration'
          || stmt.type === 'ExportDefaultDeclaration'
          || stmt.type === 'ExportNamedDeclaration'
          || stmt.type === 'TSExportAssignment'
      })
      const chunks = await Promise.all(exportStatements.map(stmt => evaluate(stmt)))
      return {
        value: chunks.reduce<{}>((exports, { value }) => {
          return { ...exports, ...(value === UNKNOWN_VALUE ? {} : value as {}) }
        }, {}),
      }
    }
    case 'ReturnStatement':
      return node.argument
        ? evaluate(node.argument)
        : { value: undefined }
    case 'SequenceExpression': {
      if (!node.expressions.length) return { value: UNKNOWN_VALUE }
      return evaluate(node.expressions[node.expressions.length - 1])
    }
    case 'TaggedTemplateExpression': {
      const { value: callee } = await evaluate(node.tag)
      if (typeof callee === 'function' && PARSEPORT_RELATED in callee) {
        return {
          value: callee[PARSEPORT_RELATED],
        }
      }
      return { value: UNKNOWN_VALUE }
    }
    case 'TemplateElement':
      return {
        value: node.value.cooked ?? node.value.raw,
      }
    case 'UnaryExpression': {
      const operator = getUnaryOperator(node.operator)
      if (operator === UNKNOWN_VALUE) return { value: UNKNOWN_VALUE }
      const { value: argument } = await evaluate(node.argument)
      return { value: callUnary(argument, operator) }
    }

    case 'ArgumentPlaceholder':
    case 'ArrayPattern': // const ->[a, b]<- = ...
    case 'AssignmentPattern':
    case 'BindExpression': // a::b (Proposal)
    case 'BreakStatement': // break
    case 'CatchClause': // try {} ->catch (e) {}<-
    case 'ClassAccessorProperty':
    case 'ClassBody':
    case 'ClassMethod':
    case 'ClassPrivateMethod':
    case 'ClassPrivateProperty':
    case 'ClassProperty':
    case 'ContinueStatement': // continue
    case 'DebuggerStatement': // debugger
    case 'Decorator': // Proposal: decorators
    case 'Directive':
    case 'DirectiveLiteral':
    case 'DoExpression': // Proposal: do expression
    case 'DoWhileStatement':
    case 'EmptyStatement': // ;
    case 'ExportDefaultSpecifier': // export ->foo<-, {} from 'foo'
    case 'ExportNamespaceSpecifier': // export ->* as foo<-, {} from 'foo'
    case 'ExportSpecifier': // export { ->foo<- } from 'foo'
    case 'ForInStatement': // for (const key in object) {}
    case 'ForOfStatement': // for (const item of array) {}
    case 'ForStatement': // for (;;) {}
    case 'IfStatement': // if (foo) {}
    case 'Import':
    case 'ImportAttribute':
    case 'ImportDefaultSpecifier': // import ->foo<- from 'foo'
    case 'ImportExpression':
    case 'ImportNamespaceSpecifier':
    case 'ImportSpecifier':
    case 'InterpreterDirective':
    case 'LabeledStatement': // foo: {}
    case 'MetaProperty': // ->import.meta<- || ->new.target<-
    case 'ModuleExpression':
    case 'NewExpression': // new Foo() (even if Array or Promise, etc)
    case 'Noop':
    case 'NumberLiteral':
    case 'ObjectPattern': // const ->{ foo }<= = ...
    case 'ParenthesizedExpression':
    case 'PipelineBareFunction':
    case 'PipelinePrimaryTopicReference':
    case 'PipelineTopicExpression':
    case 'Placeholder':
    case 'PrivateName':
    case 'RecordExpression':
    case 'RegexLiteral':
    case 'RestElement':
    case 'RestProperty':
    case 'SpreadElement':
    case 'SpreadProperty':
    case 'StaticBlock':
    case 'Super':
    case 'SwitchCase':
    case 'SwitchStatement':
    case 'ThisExpression':
    case 'ThrowStatement':
    case 'TopicReference':
    case 'TryStatement':
    case 'TupleExpression':
    case 'UpdateExpression':
    case 'V8IntrinsicIdentifier':
    case 'VariableDeclaration':
    case 'VariableDeclarator':
    case 'WhileStatement':
    case 'WithStatement':
    case 'YieldExpression':
    default:
      return { value: UNKNOWN_VALUE }
  }
}

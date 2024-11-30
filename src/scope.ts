import type { CatchClause, ClassDeclaration, Expression, FunctionDeclaration, FunctionExpression, ImportDeclaration, LVal, Node, TSImportEqualsDeclaration, VariableDeclarator } from '@babel/types'
import { isExpression, isIdentifier } from '@babel/types'
import { resolveString, walkAST } from 'ast-kit'
import { tryResolveObjectKey } from './ast-utils'

export type NodePath = (value: unknown) => unknown

export interface Reference {
  init: Node | null,
  paths: NodePath[],
}

export type FunctionParam = FunctionDeclaration['params'][number]
export type CatchParam = NonNullable<CatchClause['param']>
export type ScopeDeclaration = ImportDeclaration | TSImportEqualsDeclaration
  | FunctionDeclaration | FunctionExpression | ClassDeclaration
  | VariableDeclarator
  | FunctionParam | CatchParam

interface NamedReference extends Reference {
  name: string,
}

function resolveChildReferences(
  id: LVal | Expression,
  init: Node | null,
  paths: NodePath[],
): NamedReference[] {
  if (isIdentifier(id)) {
    return [
      {
        name: resolveString(id),
        init,
        paths,
      },
    ]
  }
  if (isExpression(id)) return []
  switch (id.type) {
    case 'ArrayPattern':
      return id.elements.flatMap((item, index) => {
        if (item === null) return []
        const currentPath = item.type === 'RestElement'
          ? (value: unknown[]) => value.slice(index)
          : (value: unknown[]) => value[index]
        return resolveChildReferences(
          item,
          init,
          [...paths, currentPath],
        )
      })
    case 'ObjectPattern': {
      const properties = id.properties.filter(item => item.type !== 'RestElement')
      const extractedKeys = properties.map(property => tryResolveObjectKey(property))
      return id.properties.flatMap(item => {
        if (item.type === 'RestElement') {
          if (!extractedKeys.every(key => key !== undefined)) {
            return resolveChildReferences(item, null, [])
          }
          const currentPath = (value: {}) => Object.fromEntries(
            Object.entries(value).filter(([key]) => !extractedKeys.includes(key)),
          )
          return resolveChildReferences(
            item,
            init,
            [...paths, currentPath],
          )
        } else {
          const index = properties.indexOf(item)
          const key = extractedKeys[index]
          if (typeof key === 'string') {
            const currentPath = (value: {}) => value[key]
            return resolveChildReferences(
              item.value,
              init,
              [...paths, currentPath],
            )
          } else {
            return resolveChildReferences(item.value, null, [])
          }
        }
      })
    }
    case 'AssignmentPattern': // function foo(->a = 1<-) {}
      return resolveChildReferences(id.left, null, [])
    case 'RestElement':
      return resolveChildReferences(id.argument, init, paths)
    case 'TSParameterProperty':
    default:
      return []
  }
}

function resolveReferences(node: ScopeDeclaration): NamedReference[] {
  switch (node.type) {
    // Declaration types
    case 'ImportDeclaration':
      return node.specifiers.map(specifier => {
        switch (specifier.type) {
          case 'ImportNamespaceSpecifier':
            return {
              name: resolveString(specifier.local),
              init: node,
              paths: [],
            }
          case 'ImportDefaultSpecifier': {
            const currentPath = (value: { default: unknown }) => value.default
            return {
              name: resolveString(specifier.local),
              init: node,
              paths: [currentPath],
            }
          }
          case 'ImportSpecifier': {
            const key = resolveString(specifier.imported)
            const currentPath = (value: {}) => value[key]
            return {
              name: resolveString(specifier.local),
              init: node,
              paths: [currentPath],
            }
          }
          default:
            return null
        }
      }).filter(reference => reference !== null)
    case 'TSImportEqualsDeclaration':
      return resolveChildReferences(node.id, node, [])
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ClassDeclaration':
      if (!node.id) return []
      return [
        {
          name: resolveString(node.id),
          init: node,
          paths: [],
        },
      ]
    case 'VariableDeclarator':
      return resolveChildReferences(
        node.id,
        node.init ?? null,
        [],
      )
    // Parameter types (without init)
    case 'Identifier':
    case 'ArrayPattern':
    case 'AssignmentPattern':
    case 'ObjectPattern':
    case 'RestElement':
      return resolveChildReferences(node, null, [])
  }
}

export interface ScopeInit {
  node: Scope['node'],
  isBlockScope?: Scope['isBlockScope'],
  parent?: Scope['parent'],
}

export class Scope {

  node: Node
  isBlockScope: boolean
  parent: Scope | null
  references: Map<string, Reference>

  constructor(options: ScopeInit) {
    this.node = options.node
    this.isBlockScope = options.isBlockScope ?? false
    this.parent = options.parent ?? null
    this.references = new Map()
  }

  add(node: ScopeDeclaration, isBlockDeclaration: boolean) {
    if (!isBlockDeclaration && this.isBlockScope) {
      if (this.parent) {
        this.parent.add(node, isBlockDeclaration)
      }
    } else {
      const refs = resolveReferences(node)
      for (const { name, init, paths } of refs) {
        this.references.set(name, { init, paths })
      }
    }
  }

  get(name: string): Reference | null {
    return this.references.get(name) ?? (this.parent ? this.parent.get(name) : null)
  }

}

export function analyzeScopes(ast: Node) {
  let scope = new Scope({
    node: ast,
  })
  const scopes = new Map<Node, Scope>()
  scopes.set(ast, scope)
  walkAST(ast, {
    enter(node, parent) {
      // TODO: imports
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (node.type) {
        case 'ImportDeclaration':
        case 'TSImportEqualsDeclaration':
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ClassDeclaration':
          scope.add(node, false)
          break
        case 'VariableDeclaration':
          for (const declarator of node.declarations) {
            scope.add(declarator, node.kind !== 'var')
          }
          break
        default:
          break
      }
      let newScope: Scope | undefined
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression': {
          newScope = new Scope({
            node,
            parent: scope,
            isBlockScope: false,
          })
          for (const param of node.params) {
            newScope.add(param, false)
          }
          break
        }
        case 'ForInStatement':
        case 'ForOfStatement':
        case 'ForStatement': {
          newScope = new Scope({
            node,
            parent: scope,
            isBlockScope: true,
          })
          break
        }
        case 'BlockStatement':
          if (!parent || parent.type !== 'FunctionDeclaration' && parent.type !== 'FunctionExpression') {
            newScope = new Scope({
              node,
              parent: scope,
              isBlockScope: true,
            })
          }
          break
        case 'CatchClause':
          newScope = new Scope({
            node,
            parent: scope,
            isBlockScope: true,
          })
          if (node.param) {
            newScope.add(node.param, false)
          }
          break
        default:
          break
      }
      if (newScope) {
        scope = newScope
      }
      scopes.set(node, scope)
    },
    leave(node) {
      if (scope.node === node) {
        scope = scope.parent!
      }
    },
  })
  return scopes
}

import type {
  AccessorProperty,
  AssignmentTargetProperty,
  BindingProperty,
  Expression,
  MethodDefinition,
  Node,
  ObjectProperty,
  PrivateIdentifier,
  PropertyDefinition,
  Super,
  TemplateLiteral,
  ThisExpression,
} from '@oxc-project/types'

export type JSXNode = Extract<Node, {
  type: 'JSXAttribute' | 'JSXClosingElement' | 'JSXElement' | 'JSXEmptyExpression' | 'JSXExpressionContainer' | 'JSXSpreadChild' | 'JSXIdentifier' | 'JSXMemberExpression' | 'JSXNamespacedName' | 'JSXOpeningElement' | 'JSXSpreadAttribute' | 'JSXText' | 'JSXFragment' | 'JSXOpeningFragment' | 'JSXClosingFragment',
}>

export function isJSX(node: Node | undefined | null): node is JSXNode {
  if (!node) return false
  switch (node.type) {
    case 'JSXAttribute':
    case 'JSXClosingElement':
    case 'JSXElement':
    case 'JSXEmptyExpression':
    case 'JSXExpressionContainer':
    case 'JSXSpreadChild':
    case 'JSXIdentifier':
    case 'JSXMemberExpression':
    case 'JSXNamespacedName':
    case 'JSXOpeningElement':
    case 'JSXSpreadAttribute':
    case 'JSXText':
    case 'JSXFragment':
    case 'JSXOpeningFragment':
    case 'JSXClosingFragment':
      return true
    default:
      return false
  }
}

export type TypeScriptNode = Extract<Node, {
  type: 'TSParameterProperty' | 'TSDeclareFunction' | 'TSQualifiedName' | 'TSCallSignatureDeclaration' | 'TSConstructSignatureDeclaration' | 'TSPropertySignature' | 'TSMethodSignature' | 'TSIndexSignature' | 'TSAnyKeyword' | 'TSBooleanKeyword' | 'TSBigIntKeyword' | 'TSIntrinsicKeyword' | 'TSNeverKeyword' | 'TSNullKeyword' | 'TSNumberKeyword' | 'TSObjectKeyword' | 'TSStringKeyword' | 'TSSymbolKeyword' | 'TSUndefinedKeyword' | 'TSUnknownKeyword' | 'TSVoidKeyword' | 'TSThisType' | 'TSFunctionType' | 'TSConstructorType' | 'TSTypeReference' | 'TSTypePredicate' | 'TSTypeQuery' | 'TSTypeLiteral' | 'TSArrayType' | 'TSTupleType' | 'TSOptionalType' | 'TSRestType' | 'TSNamedTupleMember' | 'TSUnionType' | 'TSIntersectionType' | 'TSConditionalType' | 'TSInferType' | 'TSParenthesizedType' | 'TSTypeOperator' | 'TSIndexedAccessType' | 'TSMappedType' | 'TSTemplateLiteralType' | 'TSLiteralType' | 'TSClassImplements' | 'TSInterfaceHeritage' | 'TSInterfaceDeclaration' | 'TSInterfaceBody' | 'TSTypeAliasDeclaration' | 'TSInstantiationExpression' | 'TSAsExpression' | 'TSSatisfiesExpression' | 'TSTypeAssertion' | 'TSEnumBody' | 'TSEnumDeclaration' | 'TSEnumMember' | 'TSModuleDeclaration' | 'TSModuleBlock' | 'TSImportType' | 'TSImportEqualsDeclaration' | 'TSExternalModuleReference' | 'TSNonNullExpression' | 'TSExportAssignment' | 'TSNamespaceExportDeclaration' | 'TSTypeAnnotation' | 'TSTypeParameterInstantiation' | 'TSTypeParameterDeclaration' | 'TSTypeParameter',
}>

export function isTypeScript(node: Node | undefined | null): node is TypeScriptNode {
  if (!node) return false
  switch (node.type) {
    case 'TSParameterProperty':
    case 'TSDeclareFunction':
    case 'TSQualifiedName':
    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration':
    case 'TSPropertySignature':
    case 'TSMethodSignature':
    case 'TSIndexSignature':
    case 'TSAnyKeyword':
    case 'TSBooleanKeyword':
    case 'TSBigIntKeyword':
    case 'TSIntrinsicKeyword':
    case 'TSNeverKeyword':
    case 'TSNullKeyword':
    case 'TSNumberKeyword':
    case 'TSObjectKeyword':
    case 'TSStringKeyword':
    case 'TSSymbolKeyword':
    case 'TSUndefinedKeyword':
    case 'TSUnknownKeyword':
    case 'TSVoidKeyword':
    case 'TSThisType':
    case 'TSFunctionType':
    case 'TSConstructorType':
    case 'TSTypeReference':
    case 'TSTypePredicate':
    case 'TSTypeQuery':
    case 'TSTypeLiteral':
    case 'TSArrayType':
    case 'TSTupleType':
    case 'TSOptionalType':
    case 'TSRestType':
    case 'TSNamedTupleMember':
    case 'TSUnionType':
    case 'TSIntersectionType':
    case 'TSConditionalType':
    case 'TSInferType':
    case 'TSParenthesizedType':
    case 'TSTypeOperator':
    case 'TSIndexedAccessType':
    case 'TSMappedType':
    case 'TSTemplateLiteralType':
    case 'TSLiteralType':
    case 'TSClassImplements':
    case 'TSInterfaceHeritage':
    case 'TSInterfaceDeclaration':
    case 'TSInterfaceBody':
    case 'TSTypeAliasDeclaration':
    case 'TSInstantiationExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'TSEnumBody':
    case 'TSEnumDeclaration':
    case 'TSEnumMember':
    case 'TSModuleDeclaration':
    case 'TSModuleBlock':
    case 'TSImportType':
    case 'TSImportEqualsDeclaration':
    case 'TSExternalModuleReference':
    case 'TSNonNullExpression':
    case 'TSExportAssignment':
    case 'TSNamespaceExportDeclaration':
    case 'TSTypeAnnotation':
    case 'TSTypeParameterInstantiation':
    case 'TSTypeParameterDeclaration':
    case 'TSTypeParameter':
      return true
    default:
      return false
  }
}

export type Literal = Extract<Node, { type: 'Literal' | 'TemplateLiteral' }>
export type Identifier = Extract<Node, { type: 'Identifier' | 'JSXIdentifier' }>

export type ObjectPropertyLike
  = | AccessorProperty
  | AssignmentTargetProperty
  | BindingProperty
  | MethodDefinition
  | ObjectProperty
  | PropertyDefinition

export function isIdentifier(node: Node | undefined | null): node is Identifier {
  if (!node) return false
  return node.type === 'Identifier' || node.type === 'JSXIdentifier'
}

export function isLiteral(node: Node | undefined | null): node is Literal {
  if (!node) return false
  return node.type === 'Literal' || node.type === 'TemplateLiteral'
}

export function isExpression(node: Node | undefined | null): node is Expression {
  if (!node) return false
  switch (node.type) {
    case 'ArrayExpression':
    case 'AssignmentExpression':
    case 'BinaryExpression':
    case 'CallExpression':
    case 'ConditionalExpression':
    case 'FunctionExpression':
    case 'Identifier':
    case 'LogicalExpression':
    case 'MemberExpression':
    case 'NewExpression':
    case 'ObjectExpression':
    case 'SequenceExpression':
    case 'ParenthesizedExpression':
    case 'ThisExpression':
    case 'UnaryExpression':
    case 'UpdateExpression':
    case 'ArrowFunctionExpression':
    case 'ClassExpression':
    case 'MetaProperty':
    case 'TaggedTemplateExpression':
    case 'TemplateLiteral':
    case 'YieldExpression':
    case 'AwaitExpression':
    case 'ImportExpression':
    case 'JSXElement':
    case 'JSXFragment':
    case 'TSInstantiationExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
      return true
    default:
      return false
  }
}

function resolveTemplateLiteral(node: TemplateLiteral) {
  return node.quasis.reduce((prev, curr, idx) => {
    const expr = node.expressions[idx]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (expr) {
      if (!isLiteral(expr)) {
        throw new TypeError('TemplateLiteral expression must be a literal')
      }
      return prev + curr.value.cooked + resolveLiteral(expr)
    }
    return prev + curr.value.cooked
  }, '')
}

export function resolveLiteral(node: Literal | TemplateLiteral): string | number | boolean | null | RegExp | bigint {
  if (node.type === 'TemplateLiteral') {
    return resolveTemplateLiteral(node)
  }
  if ('regex' in node) {
    return node.value ?? new RegExp(node.regex.pattern, node.regex.flags)
  }
  if ('bigint' in node) {
    return BigInt(node.bigint)
  }
  return node.value
}

export function resolveString(
  node: string | Identifier | PrivateIdentifier | Literal | ThisExpression | Super,
  computed = false,
): string {
  if (typeof node === 'string') return node
  switch (node.type) {
    case 'Identifier':
    case 'JSXIdentifier':
      if (computed) {
        throw new TypeError('Invalid Identifier')
      }
      return node.name
    case 'PrivateIdentifier':
      return `#${node.name}`
    case 'ThisExpression':
      return 'this'
    case 'Super':
      return 'super'
    default:
      node satisfies Literal
      break
  }
  return String(resolveLiteral(node))
}

export function resolveObjectKey(
  node: ObjectPropertyLike,
  raw?: false,
): string | number
export function resolveObjectKey(node: ObjectPropertyLike, raw: true): string
export function resolveObjectKey(property: ObjectPropertyLike, raw = false) {
  const { key, computed } = property
  switch (key.type) {
    case 'Literal': {
      return raw ? key.raw! : resolveLiteral(key)
    }
    case 'Identifier':
    case 'PrivateIdentifier': {
      if (computed) {
        throw new TypeError('Cannot resolve computed Identifier')
      }
      const string = resolveString(key, computed)
      return raw ? JSON.stringify(string) : string
    }
    default:
      throw new TypeError(`Unexpected node type: ${key.type}`)
  }
}

export function tryResolveObjectKey(property: ObjectPropertyLike) {
  try {
    return resolveObjectKey(property)
  } catch {
    return undefined
  }
}

import type { ArrowFunctionExpression, ClassMethod, FunctionDeclaration, FunctionExpression, ObjectMethod } from '@babel/types'

export function evaluateFunctionString(
  value: ArrowFunctionExpression | ClassMethod | FunctionDeclaration | FunctionExpression | ObjectMethod,
): string {
  return ''
}

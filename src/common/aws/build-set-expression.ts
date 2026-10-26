export interface SetExpression {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
}

/**
 * Arma un `SET campo = valor, ...` para UpdateItem. Todos los campos van con
 * alias (`#f0`), porque DynamoDB reserva palabras como `status` o `name`.
 * Los valores `undefined` se omiten; `null` se guarda como null.
 */
export function buildSetExpression(
  changes: Record<string, unknown>,
): SetExpression {
  const entries = Object.entries(changes).filter(
    ([, value]) => value !== undefined,
  );
  const assignments = entries.map((_, index) => `#f${index} = :v${index}`);
  return {
    UpdateExpression: `SET ${assignments.join(', ')}`,
    ExpressionAttributeNames: Object.fromEntries(
      entries.map(([name], index) => [`#f${index}`, name]),
    ),
    ExpressionAttributeValues: Object.fromEntries(
      entries.map(([, value], index) => [`:v${index}`, value]),
    ),
  };
}

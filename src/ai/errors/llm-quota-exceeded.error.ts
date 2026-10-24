/**
 * El proveedor rechazó la petición porque se agotó el saldo o el límite de
 * gasto. Reintentar no sirve hasta que el límite se reinicie.
 */
export class LlmQuotaExceededError extends Error {
  override readonly name = 'LlmQuotaExceededError';

  constructor() {
    super('The LLM spend limit or credit balance is exhausted.');
  }
}

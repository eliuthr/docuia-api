import { z } from 'zod';

/** Campos reutilizados por los esquemas. Todos admiten null: null significa "no está en el documento". */
export const nullableText = z.string().nullable();
export const nullableAmount = z.number().nullable();
/** Fecha ISO `YYYY-MM-DD`. */
export const nullableIsoDate = z.iso.date().nullable();
/** Código de moneda ISO 4217, por ejemplo `COP` o `USD`. */
export const nullableCurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .nullable();
/** Año y mes `YYYY-MM`, para fechas que no traen día (por ejemplo, en hojas de vida). */
export const nullableYearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .nullable();

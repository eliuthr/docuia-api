import { contractSchema } from './contract.schema.js';

const validContract = {
  title: 'Contrato de arrendamiento',
  parties: [
    { name: 'Ana Pérez', role: 'landlord' },
    { name: 'Luis Gómez', role: 'tenant' },
  ],
  effectiveDate: '2026-01-01',
  expirationDate: '2026-12-31',
  value: 1500000,
  currency: 'COP',
  governingLaw: 'Colombia',
};

describe('contractSchema', () => {
  it('accepts a complete contract', () => {
    expect(contractSchema.parse(validContract)).toEqual(validContract);
  });

  it('accepts a contract without parties or value', () => {
    const result = contractSchema.safeParse({
      ...validContract,
      parties: [],
      value: null,
      currency: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a party without a name', () => {
    const result = contractSchema.safeParse({
      ...validContract,
      parties: [{ role: 'tenant' }],
    });

    expect(result.success).toBe(false);
  });
});

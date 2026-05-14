import { addMoney, clampMoneyNonNegative, deriveInvoiceStatus, derivePaymentStatus, multiplyMoney, percentOf, toMoneyNumber } from './accounting.util';

describe('accounting.util', () => {
  it('keeps arithmetic deterministic for decimal values', () => {
    const total = addMoney(multiplyMoney(1.1, 2.2, 3.3), 0.1);
    expect(toMoneyNumber(total)).toBe(8.09);
  });

  it('clamps negative values to zero', () => {
    expect(toMoneyNumber(clampMoneyNonNegative(-120))).toBe(0);
  });

  it('derives invoice status from amount and paid amount', () => {
    expect(deriveInvoiceStatus(500, 0)).toBe('UNPAID');
    expect(deriveInvoiceStatus(500, 220)).toBe('PARTIAL');
    expect(deriveInvoiceStatus(500, 500)).toBe('PAID');
  });

  it('derives payment summary status and caps percent to 100', () => {
    expect(derivePaymentStatus(1000, 0)).toBe('unpaid');
    expect(derivePaymentStatus(1000, 250)).toBe('partial');
    expect(derivePaymentStatus(1000, 1200)).toBe('paid');
    expect(percentOf(1000, 1200)).toBe(100);
  });
});

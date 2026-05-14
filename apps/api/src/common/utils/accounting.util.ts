import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);
const ONE = new Prisma.Decimal(1);
const HUNDRED = new Prisma.Decimal(100);

function toDecimal(value: unknown) {
  if (value instanceof Prisma.Decimal) return value;
  if (value === undefined || value === null || value === '') return ZERO;
  if (typeof value === 'number' && !Number.isFinite(value)) return ZERO;
  return new Prisma.Decimal(value as Prisma.Decimal.Value);
}

export function toMoneyDecimal(value: unknown) {
  return toDecimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function clampMoneyNonNegative(value: unknown) {
  const amount = toMoneyDecimal(value);
  return amount.lessThan(ZERO) ? ZERO : amount;
}

export function addMoney(...values: unknown[]) {
  return values
    .reduce<Prisma.Decimal>((sum, value) => sum.add(toMoneyDecimal(value)), ZERO)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function subtractMoney(base: unknown, ...values: unknown[]) {
  const result = values.reduce<Prisma.Decimal>((sum, value) => sum.sub(toMoneyDecimal(value)), toMoneyDecimal(base));
  return result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function multiplyMoney(...values: unknown[]) {
  if (!values.length) return ZERO;
  return values
    .reduce<Prisma.Decimal>((product, value) => product.mul(toMoneyDecimal(value)), ONE)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function minMoney(a: unknown, b: unknown) {
  const left = toMoneyDecimal(a);
  const right = toMoneyDecimal(b);
  return left.lessThan(right) ? left : right;
}

export function maxMoney(a: unknown, b: unknown) {
  const left = toMoneyDecimal(a);
  const right = toMoneyDecimal(b);
  return left.greaterThan(right) ? left : right;
}

export function percentOf(total: unknown, part: unknown) {
  const safeTotal = clampMoneyNonNegative(total);
  if (safeTotal.lessThanOrEqualTo(ZERO)) return 0;
  const safePart = clampMoneyNonNegative(part);
  const raw = safePart.mul(HUNDRED).div(safeTotal).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  return Math.max(0, Math.min(100, raw));
}

export function toMoneyNumber(value: unknown) {
  return toMoneyDecimal(value).toNumber();
}

export function deriveInvoiceStatus(amount: unknown, paidAmount: unknown): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const amountDec = clampMoneyNonNegative(amount);
  const paidDec = clampMoneyNonNegative(paidAmount);

  if (paidDec.lessThanOrEqualTo(ZERO)) return 'UNPAID';
  if (amountDec.lessThanOrEqualTo(ZERO)) return 'PAID';
  if (paidDec.greaterThanOrEqualTo(amountDec)) return 'PAID';
  return 'PARTIAL';
}

export function derivePaymentStatus(amount: unknown, paidAmount: unknown): 'unpaid' | 'partial' | 'paid' {
  const amountDec = clampMoneyNonNegative(amount);
  const paidDec = clampMoneyNonNegative(paidAmount);

  if (paidDec.lessThanOrEqualTo(ZERO)) return 'unpaid';
  if (amountDec.lessThanOrEqualTo(ZERO)) return 'paid';
  if (paidDec.greaterThanOrEqualTo(amountDec)) return 'paid';
  return 'partial';
}

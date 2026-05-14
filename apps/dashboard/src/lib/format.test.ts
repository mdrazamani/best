import { describe, expect, it } from 'vitest';
import { money, permissionLabel, shamsiDate, textFa } from './format';

describe('format helpers', () => {
  it('formats money output with rial suffix', () => {
    expect(money(1200000)).toContain('ریال');
  });

  it('returns a non-empty persian calendar value', () => {
    const value = shamsiDate('2026-05-12T10:00:00.000Z');
    expect(value).not.toBe('-');
  });

  it('returns persian label for known permission keys', () => {
    expect(permissionLabel('orders.all')).toBe('مدیریت سفارشات');
  });

  it('returns key itself for unknown permission keys', () => {
    expect(permissionLabel('unknown.permission')).toBe('unknown.permission');
  });

  it('fixes common mojibake persian text', () => {
    expect(textFa('Ù…ÙˆØ¹Ø¯ ØªÚ©Ù…ÛŒÙ„')).toBe('موعد تکمیل');
  });

  it('replaces unreadable placeholders', () => {
    expect(textFa('?'.repeat(4))).toBe('نامشخص');
  });
});

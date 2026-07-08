export function calculateLineAreaFactor(width: number, height: number, quantity: number) {
  const areaMeters = (width * height) / 10000;
  return areaMeters > 1 ? areaMeters * quantity : quantity;
}

export function calculateLineTotal(width: number, height: number, quantity: number, unitPrice: number) {
  return calculateLineAreaFactor(width, height, quantity) * unitPrice;
}

export function calculateEffectiveLinePricing(input: {
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  lineTotalOverride?: number;
  lineTotalManual?: boolean;
  hasLineTotalOverride?: boolean;
}) {
  const calculated = calculateLineTotal(input.width, input.height, input.quantity, input.unitPrice);
  const factor = calculateLineAreaFactor(input.width, input.height, input.quantity);
  const hasManualOverride = Boolean(input.lineTotalManual && input.hasLineTotalOverride);
  const effectiveTotal = hasManualOverride ? Math.max(input.lineTotalOverride ?? 0, 0) : calculated;
  const effectiveUnitPrice = factor > 0 ? effectiveTotal / factor : input.unitPrice;

  return {
    width: input.width,
    height: input.height,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    calculated,
    effectiveTotal,
    effectiveUnitPrice
  };
}

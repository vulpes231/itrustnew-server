export function calculatePartialClose({
  quantity,
  principal,
  positionCost,
  marginDebt,
  baseValue,
  extra,
  closeRatio,
}) {
  const ratio = Math.min(1, Math.max(0, closeRatio));
  const remainingRatio = 1 - ratio;

  const quantityClosed = quantity * ratio;
  const principalClosed = principal * ratio;
  const costClosed = positionCost * ratio;
  const debtClosed = marginDebt * ratio;
  const marketValueClosed = baseValue * ratio;
  const extraClosed = extra * ratio;

  return {
    quantityClosed,
    principalClosed,
    costClosed,
    debtClosed,
    marketValueClosed,
    extraClosed,

    remainingQuantity: quantity * remainingRatio,
    remainingPrincipal: principal * remainingRatio,
    remainingCost: positionCost * remainingRatio,
    remainingDebt: marginDebt * remainingRatio,
    remainingBaseValue: baseValue * remainingRatio,
    remainingExtra: extra * remainingRatio,
  };
}

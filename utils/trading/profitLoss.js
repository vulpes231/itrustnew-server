export function calculateRealizedProfit({
  marketValue,
  positionCost,
  extra = 0,
}) {
  return marketValue - positionCost + extra;
}

export function calculateReturnPercent({ profit, principal }) {
  if (principal <= 0) return 0;

  return (profit / principal) * 100;
}

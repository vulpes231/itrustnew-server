const DEFAULT_EPSILON = 1e-8;

/**
 * Calculate market value from quantity and price.
 */
export function calculateMarketValue(quantity, price) {
  return Number(quantity) * Number(price);
}

/**
 * Calculate realized profit/loss.
 * Margin debt is excluded, consistent with your current accounting model.
 */
export function calculateRealizedProfit({
  marketValue,
  positionCost,
  extra = 0,
}) {
  return Number(marketValue) - Number(positionCost) + Number(extra);
}

/**
 * Calculate return percentage.
 */
export function calculateReturnPercent({ profit, principal }) {
  const amount = Number(principal);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return (Number(profit) / amount) * 100;
}

/**
 * Calculate the proportional values for a position-level close.
 *
 * This is intended for your existing sellAsset() flow.
 * Do not use it to close a single trade from an aggregated position
 * unless all supplied values belong to that individual trade.
 */
export function calculatePartialClose({
  quantity,
  principal,
  positionCost,
  marginDebt = 0,
  baseValue,
  extra = 0,
  closeRatio,
  epsilon = DEFAULT_EPSILON,
}) {
  const values = {
    quantity,
    principal,
    positionCost,
    marginDebt,
    baseValue,
    extra,
    closeRatio,
  };

  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(Number(value))) {
      throw new Error(`${key} must be a finite number`);
    }
  }

  if (
    quantity < 0 ||
    principal < 0 ||
    positionCost < 0 ||
    marginDebt < 0 ||
    baseValue < 0 ||
    extra < 0
  ) {
    throw new Error("Position values cannot be negative");
  }

  if (closeRatio <= 0 || closeRatio > 1) {
    throw new Error("closeRatio must be greater than 0 and at most 1");
  }

  // Normalize ratios that represent a full close.
  const isFullClose = closeRatio >= 1 - epsilon;
  const ratio = isFullClose ? 1 : closeRatio;
  const remainingRatio = 1 - ratio;

  const quantityClosed = quantity * ratio;
  const principalClosed = principal * ratio;
  const costClosed = positionCost * ratio;
  const debtClosed = marginDebt * ratio;
  const marketValueClosed = baseValue * ratio;
  const extraClosed = extra * ratio;

  const remainingQuantity = isFullClose ? 0 : quantity * remainingRatio;

  const remainingPrincipal = isFullClose ? 0 : principal * remainingRatio;

  const remainingCost = isFullClose ? 0 : positionCost * remainingRatio;

  const remainingDebt = isFullClose ? 0 : marginDebt * remainingRatio;

  const remainingBaseValue = isFullClose ? 0 : baseValue - marketValueClosed;

  const remainingExtra = isFullClose ? 0 : extra - extraClosed;

  const totalProceeds = marketValueClosed + extraClosed;

  const realizedMarketProfit = marketValueClosed - costClosed;

  const realizedProfit = realizedMarketProfit + extraClosed;

  return {
    isFullClose,
    closeRatio: ratio,

    quantityClosed,
    principalClosed,
    costClosed,
    debtClosed,
    marketValueClosed,
    extraClosed,

    totalProceeds,
    realizedMarketProfit,
    realizedProfit,

    remainingQuantity,
    remainingPrincipal,
    remainingCost,
    remainingDebt,
    remainingBaseValue,
    remainingExtra,

    remainingValue: remainingBaseValue + remainingExtra,

    remainingProfit: remainingBaseValue - remainingCost + remainingExtra,
  };
}

/**
 * Calculate the aggregate position values from open trade records.
 *
 * Pass only open buy trades belonging to the position.
 * Assumes each trade's execution values represent its remaining exposure.
 */
export function calculatePositionTotals(
  trades,
  { epsilon = DEFAULT_EPSILON } = {},
) {
  const totals = {
    quantity: 0,
    principal: 0,
    positionCost: 0,
    marginDebt: 0,
    extra: 0,
    currentBaseValue: 0,
  };

  for (const trade of trades) {
    const quantity = Number(trade.execution?.quantity ?? 0);
    const principal = Number(trade.execution?.amount ?? 0);

    const positionCost = Number(
      trade.execution?.positionCost ??
        trade.execution?.positionAmount ??
        principal,
    );

    const marginDebt = Number(trade.execution?.marginDebt ?? 0);

    const extra = Number(trade.extra ?? 0);

    const currentBaseValue = Number(
      trade.performance?.currentBaseValue ??
        quantity *
          Number(trade.performance?.currentPrice ?? trade.execution?.price),
    );

    const values = {
      quantity,
      principal,
      positionCost,
      marginDebt,
      extra,
      currentBaseValue,
    };

    for (const [key, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid ${key} in trade ${trade._id ?? "unknown"}`);
      }

      if (value < -epsilon) {
        throw new Error(`Negative ${key} in trade ${trade._id ?? "unknown"}`);
      }
    }

    totals.quantity += Math.max(0, quantity);
    totals.principal += Math.max(0, principal);
    totals.positionCost += Math.max(0, positionCost);
    totals.marginDebt += Math.max(0, marginDebt);
    totals.extra += Math.max(0, extra);
    totals.currentBaseValue += Math.max(0, currentBaseValue);
  }

  return {
    ...totals,
    currentValue: totals.currentBaseValue + totals.extra,
    totalReturn: totals.currentBaseValue - totals.positionCost + totals.extra,
    totalReturnPercent:
      totals.principal > 0
        ? ((totals.currentBaseValue - totals.positionCost + totals.extra) /
            totals.principal) *
          100
        : 0,
  };
}

/**
 * Determine whether a position has no remaining exposure.
 */
export function hasNoRemainingExposure(
  {
    quantity = 0,
    principal = 0,
    positionCost = 0,
    marginDebt = 0,
    currentBaseValue = 0,
    extra = 0,
  },
  epsilon = DEFAULT_EPSILON,
) {
  return [
    quantity,
    principal,
    positionCost,
    marginDebt,
    currentBaseValue,
    extra,
  ].every(
    (value) =>
      Number.isFinite(Number(value)) && Math.abs(Number(value)) <= epsilon,
  );
}

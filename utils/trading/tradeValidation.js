/**
 * Convert a value to a finite number.
 */
export function requireFiniteNumber(value, fieldName = "Value") {
  const number = Number(value);

  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(number)
  ) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  return number;
}

/**
 * Require a strictly positive number.
 */
export function requirePositiveNumber(value, fieldName = "Value") {
  const number = requireFiniteNumber(value, fieldName);

  if (number <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }

  return number;
}

/**
 * Require a non-negative number.
 */
export function requireNonNegativeNumber(value, fieldName = "Value") {
  const number = requireFiniteNumber(value, fieldName);

  if (number < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  return number;
}

/**
 * Validate a close ratio.
 */
export function validateCloseRatio(value) {
  const ratio = requireFiniteNumber(value, "Close ratio");

  if (ratio <= 0 || ratio > 1) {
    throw new Error("Close ratio must be greater than zero and at most one");
  }

  return ratio;
}

/**
 * Validate a positive asset price.
 */
export function validateMarketPrice(value) {
  return requirePositiveNumber(value, "Market price");
}

/**
 * Validate the quantity being closed.
 */
export function validateCloseQuantity(
  closeQuantity,
  availableQuantity,
  epsilon = 1e-8,
) {
  const closing = requirePositiveNumber(closeQuantity, "Close quantity");

  const available = requireNonNegativeNumber(
    availableQuantity,
    "Available quantity",
  );

  if (closing > available + epsilon) {
    throw new Error("Close quantity exceeds the available position quantity");
  }

  return Math.min(closing, available);
}

/**
 * Validate required identifiers.
 */
export function validateTradeIdentifiers({ userId, tradeId }) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!tradeId) {
    throw new Error("Trade ID is required");
  }

  return { userId, tradeId };
}

/**
 * Validate a trade's remaining accounting values.
 */
export function validateTradeAccounting({
  quantity,
  principal,
  positionCost,
  marginDebt = 0,
  extra = 0,
}) {
  return {
    quantity: requireNonNegativeNumber(quantity, "Trade quantity"),
    principal: requireNonNegativeNumber(principal, "Trade principal"),
    positionCost: requireNonNegativeNumber(positionCost, "Position cost"),
    marginDebt: requireNonNegativeNumber(marginDebt, "Margin debt"),
    extra: requireNonNegativeNumber(extra, "Trade extra"),
  };
}

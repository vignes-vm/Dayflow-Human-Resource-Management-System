import { Decimal } from "decimal.js";

/**
 * All money and percentage arithmetic in Dayflow goes through this module.
 * Never use JavaScript floats for currency — see CLAUDE.md rule 6.
 */

export type MoneyInput = Decimal.Value;

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return new Decimal(a).plus(b);
}

export function sub(a: MoneyInput, b: MoneyInput): Decimal {
  return new Decimal(a).minus(b);
}

export function mul(a: MoneyInput, b: MoneyInput): Decimal {
  return new Decimal(a).times(b);
}

/** percent of base, e.g. pctOf(50000, 8.33) → 8.33% of 50000 */
export function pctOf(base: MoneyInput, percent: MoneyInput): Decimal {
  return new Decimal(base).times(new Decimal(percent).dividedBy(100));
}

/** Round to 2dp, half-up. Apply only at the presentation/storage boundary — never mid-calculation. */
export function round2(value: MoneyInput): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function toDisplay(value: MoneyInput, currency = "₹"): string {
  return `${currency}${round2(value).toFixed(2)}`;
}

import { calculateLaunchTotalDue } from '@goton/math-sdk';

export interface LaunchInputs {
  /** The chain's launch fee, in its native currency. */
  launchFee: number;
  /** The smallest creator pre-buy the chain's factory accepts; 0 where there is none. */
  minPrebuy: number;
  /** The chain's factory rejects a launch with both taxes at 0%. */
  taxRequired: boolean;
  initialBuy: string | number;
  buyTax: string | number;
  sellTax: string | number;
}

export interface LaunchRequirements {
  prebuyTooLow: boolean;
  taxMissing: boolean;
  /** What the launch will really take as the pre-buy: never below the required minimum. */
  effectiveBuy: number;
  totalDue: number;
  blocked: boolean;
}

const amount = (value: string | number) => Number.parseFloat(String(value)) || 0;

/** What a launch costs and what stops it, for the form to show before the wallet is involved. */
export function launchRequirements(inputs: LaunchInputs): LaunchRequirements {
  const buy = amount(inputs.initialBuy);
  const prebuyTooLow = buy < inputs.minPrebuy;
  const taxMissing =
    inputs.taxRequired && !(amount(inputs.buyTax) > 0) && !(amount(inputs.sellTax) > 0);
  const effectiveBuy = Math.max(buy, inputs.minPrebuy);
  return {
    prebuyTooLow,
    taxMissing,
    effectiveBuy,
    totalDue: calculateLaunchTotalDue(inputs.launchFee, effectiveBuy),
    blocked: prebuyTooLow || taxMissing,
  };
}

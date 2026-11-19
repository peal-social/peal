/** The count the account calculator settled on, and its band's index. */
export interface PricingDetail {
  readonly accounts: number;
  readonly band: number;
}

/**
 * `peal:pricing`, which the account calculator dispatches on `window` 2 s
 * after its count last changed (never on its first render); measurement
 * counts it as `pricing_calculator_used`.
 */
export class PricingChanged extends CustomEvent<PricingDetail> {
  static readonly type = "peal:pricing";

  constructor(detail: PricingDetail) {
    super(PricingChanged.type, { detail });
  }
}

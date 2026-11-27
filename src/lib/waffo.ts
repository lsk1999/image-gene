// Waffo amounts are decimal display strings, not minor units.
export function usdCents(value: string) {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value))
    throw new Error("Invalid Waffo amount.");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function refundedCredits(
  credits: number,
  refundedCents: number,
  chargedCents: number,
) {
  if (
    ![credits, refundedCents, chargedCents].every(Number.isSafeInteger) ||
    credits < 1 ||
    chargedCents < 1 ||
    refundedCents < 0 ||
    refundedCents > chargedCents
  ) {
    throw new Error("Invalid refund totals.");
  }
  // Integer arithmetic avoids rounding errors; calculate from cumulative refunds.
  return Number(
    (BigInt(credits) * BigInt(refundedCents) +
      BigInt(chargedCents) -
      BigInt(1)) /
      BigInt(chargedCents),
  );
}

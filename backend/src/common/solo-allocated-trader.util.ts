/** Emma’s Solo book: deposited allocation minus live trading and profits. */

export const DEFAULT_SOLO_ALLOCATED_EMAIL = 'etuyizere64@gmail.com';
export const DEFAULT_SOLO_ALLOCATED_DEPOSIT_USDT = 500;

export function allocatedTraderEmail(): string {
  return (
    process.env.SOLO_ALLOCATED_TRADER_EMAIL ?? DEFAULT_SOLO_ALLOCATED_EMAIL
  )
    .trim()
    .toLowerCase();
}

export function allocatedDepositUsdt(): number {
  const n = Number(
    process.env.SOLO_ALLOCATED_DEPOSIT_USDT ??
      DEFAULT_SOLO_ALLOCATED_DEPOSIT_USDT,
  );
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SOLO_ALLOCATED_DEPOSIT_USDT;
}

export function isSoloAllocatedTraderEmail(email?: string | null): boolean {
  if (!email?.trim()) return false;
  return email.trim().toLowerCase() === allocatedTraderEmail();
}

export function roundAllocatedUsdt(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Live book looks like the shared admin account, not the $500 allocation. */
export function isSharedLiveBook(liveEquity: number, deposit: number): boolean {
  return liveEquity > deposit * 2.5;
}

export function computeAllocatedRemaining(input: {
  deposit: number;
  liveTradingBalance: number;
  profitsMade: number;
}): number {
  return roundAllocatedUsdt(
    Math.max(
      0,
      input.deposit - input.liveTradingBalance - input.profitsMade,
    ),
  );
}

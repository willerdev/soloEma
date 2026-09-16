/** Second product: Trade Guard Solo (investor-only API process). */
export function isSoloApp(): boolean {
  return (process.env.APP_VARIANT || '').trim().toLowerCase() === 'solo';
}

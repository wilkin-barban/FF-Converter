export function resolveConcurrencyLimit(
  configuredMaximum: number,
  automaticEnabled: boolean,
  automaticRecommendation: number
): number {
  const maximum = Math.max(1, Math.trunc(configuredMaximum));
  if (!automaticEnabled) return maximum;
  return Math.min(maximum, Math.max(1, Math.trunc(automaticRecommendation)));
}

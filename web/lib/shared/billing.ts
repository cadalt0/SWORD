/// The exact seconds in a billing period given in days. Days can be fractional for periods shorter than a day.
export const periodSecondsOf = (days: number) => Math.round(days * 86_400);

/// "10 seconds", "5 minutes", "6 hours": a period shorter than a day.
function shortPeriod(days: number): string {
  const s = periodSecondsOf(days);
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (s < 60) return unit(s, "second");
  if (s < 3600) return unit(Math.round(s / 60), "minute");
  return unit(Math.round(s / 3600), "hour");
}

/// "month", "week", "year", or "30 days": how a billing period reads in a sentence.
export function periodName(days: number): string {
  if (days < 1) return shortPeriod(days);
  if (days === 1) return "day";
  if (days === 7) return "week";
  if (days === 14) return "2 weeks";
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  if (days === 365) return "year";
  return `${days} days`;
}

/// "Monthly", "Weekly", or "Every 45 days".
export function periodAdjective(days: number): string {
  if (days < 1) return `Every ${shortPeriod(days)}`;
  if (days === 1) return "Daily";
  if (days === 7) return "Weekly";
  if (days === 30) return "Monthly";
  if (days === 90) return "Quarterly";
  if (days === 365) return "Yearly";
  return `Every ${periodName(days)}`;
}

/// The link a merchant shares for one subscription. Its one customer opens it to subscribe.
export function subscribeLink(origin: string, subscriptionId: string): string {
  return `${origin}/subscribe?id=${subscriptionId}`;
}

/// Local money: the countries Sword pays in and out of, with each one's currency and the way people pay there.
/// Stablecoins track the US dollar, so one coin is converted at the dollar's rate.

export type Country = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  /// How people send money there, in the words they use.
  rails: string;
  /// What a payer types after paying: the id their bank or app shows.
  referenceLabel: string;
  /// What identifies the bank account money is sent to.
  accountLabel: string;
};

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", rails: "ACH or wire", referenceLabel: "Transfer ID", accountLabel: "Account number" },
  { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", rails: "UPI, IMPS or NEFT", referenceLabel: "UTR number", accountLabel: "Account number or UPI ID" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", rails: "Faster Payments", referenceLabel: "Payment reference", accountLabel: "Account number" },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", rails: "SEPA Instant", referenceLabel: "Transaction ID", accountLabel: "IBAN" },
  { code: "FR", name: "France", flag: "🇫🇷", currency: "EUR", rails: "SEPA Instant", referenceLabel: "Transaction ID", accountLabel: "IBAN" },
  { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", rails: "SEPA Instant or Bizum", referenceLabel: "Transaction ID", accountLabel: "IBAN" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", rails: "Pix", referenceLabel: "Pix transaction ID", accountLabel: "Pix key or account" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", rails: "SPEI", referenceLabel: "Clave de rastreo", accountLabel: "CLABE" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", rails: "NIP bank transfer", referenceLabel: "Session ID", accountLabel: "Account number" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", rails: "M-Pesa or bank transfer", referenceLabel: "M-Pesa code", accountLabel: "Phone or account number" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", rails: "EFT or PayShap", referenceLabel: "Payment reference", accountLabel: "Account number" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", currency: "AED", rails: "Bank transfer", referenceLabel: "Transaction ID", accountLabel: "IBAN" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", currency: "SGD", rails: "PayNow or FAST", referenceLabel: "Transaction ID", accountLabel: "Account number or PayNow ID" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", currency: "PHP", rails: "InstaPay or GCash", referenceLabel: "Reference number", accountLabel: "Account or mobile number" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", currency: "IDR", rails: "BI-FAST or QRIS", referenceLabel: "Reference number", accountLabel: "Account number" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", currency: "VND", rails: "NAPAS 247", referenceLabel: "Transaction ID", accountLabel: "Account number" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", currency: "TRY", rails: "FAST", referenceLabel: "Transaction ID", accountLabel: "IBAN" },
  { code: "JP", name: "Japan", flag: "🇯🇵", currency: "JPY", rails: "Zengin bank transfer", referenceLabel: "Transaction ID", accountLabel: "Account number" },
  { code: "KR", name: "South Korea", flag: "🇰🇷", currency: "KRW", rails: "Bank transfer", referenceLabel: "Transaction ID", accountLabel: "Account number" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", rails: "Interac e-Transfer", referenceLabel: "Reference number", accountLabel: "Account number or email" },
  { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", rails: "PayID or Osko", referenceLabel: "Transaction ID", accountLabel: "BSB and account, or PayID" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", currency: "PKR", rails: "Raast", referenceLabel: "Transaction ID", accountLabel: "IBAN or Raast ID" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", currency: "BDT", rails: "bKash or bank transfer", referenceLabel: "Transaction ID", accountLabel: "Account or mobile number" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", rails: "Transferencias 3.0", referenceLabel: "Transaction ID", accountLabel: "CBU or alias" },
];

export const CURRENCIES = [...new Set(COUNTRIES.map((c) => c.currency))];

export function countryOf(code: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/// Dollar rates to use if the live rates cannot be reached. Close to recent market rates.
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, INR: 88.6, GBP: 0.76, EUR: 0.87, BRL: 5.35, MXN: 18.4, NGN: 1450, KES: 129, ZAR: 17.3, AED: 3.6725, SGD: 1.3,
  PHP: 58.9, IDR: 16650, VND: 26300, TRY: 42.1, JPY: 153, KRW: 1440, CAD: 1.41, AUD: 1.53, PKR: 282, BDT: 122, ARS: 1450,
};

export type Rates = { base: "USD"; rates: Record<string, number>; updatedAt: string; live: boolean };

/// Formats an amount of local money the way that currency is written.
export function formatFiat(amount: number, currency: string): string {
  const big = ["JPY", "KRW", "VND", "IDR"].includes(currency);
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: big ? 0 : 2,
    maximumFractionDigits: big ? 0 : 2,
  }).format(amount);
}

/// Converts stablecoins (dollars) to local money.
export function toFiat(coins: number, currency: string, rates: Record<string, number>): number {
  return coins * (rates[currency] ?? FALLBACK_RATES[currency] ?? 1);
}

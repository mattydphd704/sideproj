// G27: currency list with the device region's currency suggested first.
export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NZD", "INR", "JPY", "MXN", "CHF"];

const REGION_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD", IN: "INR", JP: "JPY", MX: "MXN", CH: "CHF",
  IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR",
};

export function guessCurrency(locale = typeof navigator !== "undefined" ? navigator.language : "en-US") {
  const region = locale.split("-")[1]?.toUpperCase() ?? "";
  return REGION_CURRENCY[region] ?? "USD";
}

export function currencyLabel(code: string) {
  try {
    const name = new Intl.DisplayNames(undefined, { type: "currency" }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

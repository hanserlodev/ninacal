const number0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const number1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const numberData = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const MONTHS_MIN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function formatCount(value: number): string {
  return number0.format(value);
}

export function formatDecimal(value: number): string {
  return number1.format(value);
}

/** Precise display for harmonized hotspot-days; downloads retain full source precision. */
export function formatDataValue(value: number): string {
  return numberData.format(value);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return number0.format(value);
}

export function formatSigned(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  const abs = Math.abs(rounded).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${abs}`;
}

export function formatPercent(value: number): string {
  const rounded = Number(value.toFixed(0));
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
}

export function monthName(month: number, short = false): string {
  const name = MONTHS[Math.min(11, Math.max(0, month - 1))];
  return short ? name.slice(0, 3) : name;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

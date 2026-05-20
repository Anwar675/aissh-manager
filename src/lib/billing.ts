export type BillingSource = {
  cost?: string | null;
  pricePerHour?: number | null;
  currency?: string | null;
  createdAt: string;
  connectedAt?: string | null;
  usageStartedAt?: string | null;
  usageEndedAt?: string | null;
};

export type CurrencyCode = "USD" | "VND";

export const USD_TO_VND_RATE = 25000;

type HourlyPrice = {
  amount: number;
  currency: CurrencyCode;
};

const normalizeCurrency = (currency?: string | null): CurrencyCode =>
  currency === "VND" ? "VND" : "USD";

const convertMoney = (
  amount: number,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
) => {
  if (sourceCurrency === targetCurrency) {
    return amount;
  }

  return sourceCurrency === "USD"
    ? amount * USD_TO_VND_RATE
    : amount / USD_TO_VND_RATE;
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const formatDuration = (startValue: string, endDate: Date) => {
  const startDate = new Date(startValue);

  if (Number.isNaN(startDate.getTime())) {
    return "Not available";
  }

  const totalMinutes = Math.max(
    0,
    Math.floor((endDate.getTime() - startDate.getTime()) / 60000),
  );
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const getUsageHours = (startValue: string, endDate: Date) => {
  const startDate = new Date(startValue);

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 3600000);
};

export const parseHourlyPrice = (item: BillingSource): HourlyPrice | null => {
  if (typeof item.pricePerHour === "number") {
    return {
      amount: item.pricePerHour,
      currency: normalizeCurrency(item.currency),
    };
  }

  if (!item.cost) {
    return null;
  }

  const amount = Number(item.cost.replace(/[^0-9.,-]/g, "").replace(",", "."));

  if (Number.isNaN(amount)) {
    return null;
  }

  return {
    amount,
    currency: item.cost.includes("\u20ab") ? "VND" : "USD",
  };
};

export const formatMoney = (amount: number, currency: CurrencyCode) => {
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
};

export const getUsageStart = (item: BillingSource) =>
  item.connectedAt ?? item.usageStartedAt ?? item.createdAt;

export const getBillingEnd = (item: BillingSource, fallbackDate: Date) => {
  if (!item.usageEndedAt) {
    return fallbackDate;
  }

  const endDate = new Date(item.usageEndedAt);

  return Number.isNaN(endDate.getTime()) ? fallbackDate : endDate;
};

export const getHourlyPriceLabel = (
  item: BillingSource,
  displayCurrency?: CurrencyCode,
) => {
  const hourlyPrice = parseHourlyPrice(item);

  if (!hourlyPrice) {
    return "Not set";
  }

  const currency = displayCurrency ?? hourlyPrice.currency;
  const amount = convertMoney(hourlyPrice.amount, hourlyPrice.currency, currency);

  return `${formatMoney(amount, currency)}/hr`;
};

export const getTotalCostLabel = (
  item: BillingSource,
  fallbackEndDate: Date,
  displayCurrency?: CurrencyCode,
) => {
  const hourlyPrice = parseHourlyPrice(item);
  const usageHours = getUsageHours(
    getUsageStart(item),
    getBillingEnd(item, fallbackEndDate),
  );

  if (!hourlyPrice || usageHours === null) {
    return "Not available";
  }

  const currency = displayCurrency ?? hourlyPrice.currency;
  const amount = convertMoney(
    hourlyPrice.amount * usageHours,
    hourlyPrice.currency,
    currency,
  );

  return formatMoney(amount, currency);
};

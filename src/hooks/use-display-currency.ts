"use client";

import * as React from "react";

import type { CurrencyCode } from "@/lib/billing";

const STORAGE_KEY = "aissh-display-currency";
const CHANGE_EVENT = "aissh-display-currency-change";

const readDisplayCurrency = (): CurrencyCode => {
  if (typeof window === "undefined") {
    return "USD";
  }

  return window.localStorage.getItem(STORAGE_KEY) === "VND" ? "VND" : "USD";
};

export function useDisplayCurrency() {
  const [displayCurrency, setDisplayCurrencyState] =
    React.useState<CurrencyCode>(readDisplayCurrency);

  React.useEffect(() => {
    const syncDisplayCurrency = () => {
      setDisplayCurrencyState(readDisplayCurrency());
    };

    window.addEventListener("storage", syncDisplayCurrency);
    window.addEventListener(CHANGE_EVENT, syncDisplayCurrency);

    return () => {
      window.removeEventListener("storage", syncDisplayCurrency);
      window.removeEventListener(CHANGE_EVENT, syncDisplayCurrency);
    };
  }, []);

  const setDisplayCurrency = React.useCallback((currency: CurrencyCode) => {
    window.localStorage.setItem(STORAGE_KEY, currency);
    setDisplayCurrencyState(currency);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggleDisplayCurrency = React.useCallback(() => {
    setDisplayCurrency(displayCurrency === "USD" ? "VND" : "USD");
  }, [displayCurrency, setDisplayCurrency]);

  return {
    displayCurrency,
    setDisplayCurrency,
    toggleDisplayCurrency,
  };
}

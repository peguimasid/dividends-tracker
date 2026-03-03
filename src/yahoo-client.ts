import axios from "axios";
import type { YahooChartResponse, YahooStockMeta } from "./types.js";

const YAHOO_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const REQUEST_TIMEOUT_MS = 15_000;

const api = axios.create({ baseURL: YAHOO_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

/**
 * Fetch stock metadata for a given Yahoo Finance ticker.
 *
 * Brazilian stocks require the ".SA" suffix (e.g. "BBAS3.SA", "PETR4.SA").
 * Returns price, volume, 52-week range, and exchange metadata.
 */
export async function fetchStockData(ticker: string): Promise<YahooStockMeta> {
  const { data } = await api.get<YahooChartResponse>(`/${ticker}`, {
    params: { interval: "1d", range: "1d" },
  });

  const result = data.chart.result?.[0];

  if (!result) {
    throw new Error(`No Yahoo Finance data found for ticker: ${ticker}`);
  }

  return result.meta;
}

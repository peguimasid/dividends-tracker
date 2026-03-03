/**
 * B3 API Client
 *
 * Provides access to two B3 endpoints for dividend data:
 *
 * ## 1. GetListedSupplementCompany (recommended for recent data)
 *    - Single request, no pagination
 *    - Uses `issuingCompany` directly (e.g. "BBAS", "PETR")
 *    - Returns cashDividends, stockDividends, and subscriptions
 *    - Richer fields: paymentDate, relatedTo, isinCode
 *    - Only returns ~1 year of data
 *
 * ## 2. GetListedCashDividends (for full historical data)
 *    - Requires pagination (pageSize max ~20)
 *    - Requires a prior call to GetInitialCompanies to resolve the tradingName
 *    - Returns decades of dividend history
 *    - Has closingPricePriorExDate (market price at ex-date)
 *    - No paymentDate field
 *
 * Both endpoints use base64-encoded JSON params appended to the URL path.
 * A shared axios session is used to reuse cookies and avoid Cloudflare rate-limits.
 */

import axios from "axios";
import type {
  B3CompanyResponse,
  B3HistoricalDividend,
  B3HistoricalDividendResponse,
  B3SupplementCompany,
} from "./types.js";

const B3_BASE_URL = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall";

const PAGE_SIZE = 20;
const LANGUAGE = "pt-br";
const REQUEST_TIMEOUT_MS = 15_000;

function encodeParams(params: Record<string, string | number>): string {
  return btoa(JSON.stringify(params));
}

const api = axios.create({ baseURL: B3_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

// ---------------------------------------------------------------------------
// GetInitialCompanies — resolve ticker to tradingName
// ---------------------------------------------------------------------------

/**
 * Look up the tradingName for a given issuing company code.
 *
 * The tradingName is required by the historical dividend endpoint.
 * Example: "BBAS" → "BRASIL", "PETR" → "PETROBRAS"
 */
export async function getTradingName(issuingCompany: string): Promise<string> {
  const encoded = encodeParams({
    language: LANGUAGE,
    pageNumber: 1,
    pageSize: PAGE_SIZE,
    company: issuingCompany,
  });

  const endpoint = `/GetInitialCompanies/${encoded}`;

  const { data } = await api.get<B3CompanyResponse>(endpoint);

  const match = data.results.find(
    (c) => c.issuingCompany.toUpperCase() === issuingCompany.toUpperCase(),
  );

  if (!match) {
    throw new Error(`Company not found: ${issuingCompany}`);
  }

  return match.tradingName.replaceAll("/", "").replaceAll(".", "").trim();
}

// ---------------------------------------------------------------------------
// GetListedSupplementCompany — recent data, single request
// ---------------------------------------------------------------------------

/**
 * Fetch supplement company data including recent dividends, stock events,
 * and subscriptions. Returns ~1 year of data in a single request.
 *
 * @param issuingCompany - The B3 issuing company code (e.g. "BBAS", "PETR")
 */
export async function fetchSupplementCompany(issuingCompany: string): Promise<B3SupplementCompany> {
  const encoded = encodeParams({
    issuingCompany: issuingCompany.toUpperCase(),
    language: LANGUAGE,
  });

  const endpoint = `/GetListedSupplementCompany/${encoded}`;

  const { data } = await api.get<B3SupplementCompany[]>(endpoint);

  if (!data.length) {
    throw new Error(`No supplement data found for: ${issuingCompany}`);
  }

  // The API always returns a single-element array per issuingCompany
  return data[0];
}

// ---------------------------------------------------------------------------
// GetListedCashDividends — full historical data, paginated
// ---------------------------------------------------------------------------

/**
 * Fetch the full dividend history for a company. Handles pagination
 * automatically. This can return hundreds of records spanning decades.
 *
 * Requires the tradingName (resolved via getTradingName) because this
 * endpoint doesn't accept issuingCompany directly.
 *
 * @param tradingName - The company's trading name on B3 (e.g. "PETROBRAS")
 */
export async function fetchHistoricalDividends(
  tradingName: string,
): Promise<B3HistoricalDividend[]> {
  const results: B3HistoricalDividend[] = [];
  let page = 1;
  let totalPages: number | null = null;

  while (totalPages === null || page <= totalPages) {
    const encoded = encodeParams({
      language: LANGUAGE,
      pageNumber: page,
      pageSize: PAGE_SIZE,
      tradingName,
    });

    const { data } = await api.get<B3HistoricalDividendResponse>(
      `/GetListedCashDividends/${encoded}`,
    );

    if (data.results.length === 0) break;

    totalPages = data.page.totalPages;
    results.push(...data.results);
    page++;
  }

  return results;
}

import { fetchHistoricalDividends, fetchSupplementCompany, getTradingName } from "./b3-client.js";
import { extractIssuingCompany } from "./helpers.js";

const TICKER = "BBAS3";
const ISSUING_COMPANY = extractIssuingCompany(TICKER);

async function getRecentDividends() {
  const supplement = await fetchSupplementCompany(ISSUING_COMPANY);

  return {
    ticker: TICKER,
    company: supplement.tradingName.trim(),
    code: supplement.code,
    segment: supplement.segment,
    totalShares: supplement.totalNumberShares,
    cashDividends: supplement.cashDividends,
  };
}

async function getHistoricalDividends() {
  const tradingName = await getTradingName(ISSUING_COMPANY);
  const dividends = await fetchHistoricalDividends(tradingName);

  return {
    ticker: TICKER,
    totalRecords: dividends.length,
    dividends,
  };
}

async function main(): Promise<void> {
  const [recent, historical] = await Promise.all([getRecentDividends(), getHistoricalDividends()]);

  console.log(JSON.stringify({ recent, historical }, null, 2));
}

await main();

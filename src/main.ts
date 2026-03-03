import { fetchHistoricalDividends, fetchSupplementCompany, getTradingName } from "./b3-client.js";
import { extractIssuingCompany, parseBrazilianDecimal } from "./helpers.js";
import { fetchStockData } from "./yahoo-client.js";

const TICKER = "PETR4";
const ISSUING_COMPANY = extractIssuingCompany(TICKER);
const YAHOO_TICKER = `${TICKER}.SA`;

async function main(): Promise<void> {
  const [supplement, tradingName, stockMeta] = await Promise.all([
    fetchSupplementCompany(ISSUING_COMPANY),
    getTradingName(ISSUING_COMPANY),
    fetchStockData(YAHOO_TICKER),
  ]);

  const historicalDividends = await fetchHistoricalDividends(tradingName);

  const change = +(stockMeta.regularMarketPrice - stockMeta.chartPreviousClose).toFixed(2);
  const changePct = +((change / stockMeta.chartPreviousClose) * 100).toFixed(2);

  const result = {
    symbol: TICKER,
    shortName: stockMeta.shortName,
    longName: stockMeta.longName,
    currency: stockMeta.currency,
    regularMarketPrice: stockMeta.regularMarketPrice,
    regularMarketDayHigh: stockMeta.regularMarketDayHigh,
    regularMarketDayLow: stockMeta.regularMarketDayLow,
    regularMarketDayRange: `${stockMeta.regularMarketDayLow} - ${stockMeta.regularMarketDayHigh}`,
    regularMarketChange: change,
    regularMarketChangePercent: changePct,
    regularMarketTime: new Date(stockMeta.regularMarketTime * 1000).toISOString(),
    regularMarketVolume: stockMeta.regularMarketVolume,
    regularMarketPreviousClose: stockMeta.chartPreviousClose,
    fiftyTwoWeekRange: `${stockMeta.fiftyTwoWeekLow} - ${stockMeta.fiftyTwoWeekHigh}`,
    fiftyTwoWeekLow: stockMeta.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: stockMeta.fiftyTwoWeekHigh,
    logourl: `https://icons.brapi.dev/icons/${TICKER}.svg`,
    dividendsData: {
      cashDividends: supplement.cashDividends.map((d) => ({
        assetIssued: d.assetIssued,
        paymentDate: d.paymentDate,
        rate: parseBrazilianDecimal(d.rate),
        approvedOn: d.approvedOn,
        label: d.label,
        lastDatePrior: d.lastDatePrior,
      })),
      stockDividends: supplement.stockDividends.map((d) => ({
        assetIssued: d.assetIssued,
        factor: parseBrazilianDecimal(d.factor),
        approvedOn: d.approvedOn,
        label: d.label,
        lastDatePrior: d.lastDatePrior,
      })),
      subscriptions: supplement.subscriptions,
      historicalCashDividends: historicalDividends,
    },
  };

  console.log(JSON.stringify({ result }, null, 2));
}

await main();

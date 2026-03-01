import { fetchHistoricalDividends, fetchSupplementCompany, getTradingName } from "./b3-client.js";
import { extractIssuingCompany, formatBRL, parseBrazilianDecimal } from "./helpers.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TICKER = "BBAS3";
const ISSUING_COMPANY = extractIssuingCompany(TICKER);

// ---------------------------------------------------------------------------
// Supplement endpoint — recent data, single request
// ---------------------------------------------------------------------------

async function showRecentDividends(): Promise<void> {
  console.log(`\n=== Recent dividends for ${TICKER} (supplement endpoint) ===\n`);

  const supplement = await fetchSupplementCompany(ISSUING_COMPANY);

  console.log(`Company: ${supplement.tradingName.trim()} (${supplement.code})`);
  console.log(`Segment: ${supplement.segment}`);
  console.log(`Total shares: ${supplement.totalNumberShares}\n`);

  const grouped = Object.groupBy(supplement.cashDividends, (d) => d.label);

  for (const [label, dividends] of Object.entries(grouped)) {
    if (!dividends) continue;

    const total = dividends.reduce((sum, d) => sum + parseBrazilianDecimal(d.rate), 0);

    console.log(`--- ${label} (${dividends.length} events) ---`);

    for (const d of dividends) {
      const value = parseBrazilianDecimal(d.rate);
      console.log(
        `  ${d.approvedOn}  Payment: ${d.paymentDate}  ${formatBRL(value)}  [${d.relatedTo}]`,
      );
    }

    console.log(`  Total: ${formatBRL(total, 4)}\n`);
  }
}

// ---------------------------------------------------------------------------
// Historical endpoint — full history, paginated
// ---------------------------------------------------------------------------

async function showHistoricalDividends(): Promise<void> {
  console.log(`\n=== Full historical dividends for ${TICKER} (paginated endpoint) ===\n`);

  const tradingName = await getTradingName(ISSUING_COMPANY);
  const dividends = await fetchHistoricalDividends(tradingName);

  console.log(`Total records: ${dividends.length}\n`);

  const grouped = Object.groupBy(dividends, (d) => d.corporateAction);

  for (const [action, records] of Object.entries(grouped)) {
    if (!records) continue;

    const total = records.reduce((sum, d) => sum + parseBrazilianDecimal(d.valueCash), 0);

    console.log(`--- ${action} (${records.length} events) ---`);

    for (const d of records.slice(0, 5)) {
      const value = parseBrazilianDecimal(d.valueCash);
      console.log(
        `  ${d.dateApproval}  Ex: ${d.lastDatePriorEx}  ${formatBRL(value)}  [${d.typeStock}]`,
      );
    }

    if (records.length > 5) {
      console.log(`  ... and ${records.length - 5} more`);
    }

    console.log(`  Total: ${formatBRL(total, 4)}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await showRecentDividends();
  await showHistoricalDividends();
}

await main();

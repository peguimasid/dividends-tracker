"""
Fetch dividend and JCP (Juros sobre Capital Próprio) data for a given stock
directly from B3's public API, then compare the results with Brapi for validation.

B3 API endpoint:
  GET https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedCashDividends/<base64_params>

  The params are a base64-encoded JSON object with the following fields:
    - language: "pt-br"
    - pageNumber: int (1-indexed)
    - pageSize: int (max ~20; larger values return empty)
    - tradingName: str (e.g. "PETROBRAS")

  The response contains both ON and PN records across multiple pages.
  Corporate action types: "DIVIDENDO", "JRS CAP PROPRIO", "RENDIMENTO".

Brapi API endpoint (used only for validation):
  GET https://brapi.dev/api/quote/<TICKER>?dividends=true
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import requests


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

StockType = Literal["ON", "PN"]
ActionType = Literal["DIVIDENDO", "JRS CAP PROPRIO", "RENDIMENTO"]

# Map B3's "corporateAction" label to a unified label for comparison with Brapi
B3_ACTION_TO_LABEL: dict[str, str] = {
    "DIVIDENDO": "DIVIDENDO",
    "JRS CAP PROPRIO": "JCP",
    "RENDIMENTO": "RENDIMENTO",
}


@dataclass(frozen=True)
class CashDividend:
    """A single cash dividend/JCP event from B3."""

    stock_type: StockType
    date_approval: datetime
    value_per_share: float
    corporate_action: str  # raw B3 label
    label: str  # normalized label (DIVIDENDO / JCP / RENDIMENTO)
    last_date_prior_ex: datetime
    closing_price_prior_ex: float


@dataclass(frozen=True)
class BrapiDividend:
    """A single cash dividend/JCP event from Brapi (used for comparison)."""

    label: str
    rate: float
    approved_on: datetime | None
    last_date_prior: datetime | None


# ---------------------------------------------------------------------------
# B3 API helpers
# ---------------------------------------------------------------------------

B3_BASE_URL = (
    "https://sistemaswebb3-listados.b3.com.br"
    "/listedCompaniesProxy/CompanyCall/GetListedCashDividends"
)
B3_PAGE_SIZE = 20  # max reliable page size for this endpoint


def _encode_b3_params(trading_name: str, page: int) -> str:
    """Encode the query params as base64 JSON, as required by B3's API."""
    params = {
        "language": "pt-br",
        "pageNumber": page,
        "pageSize": B3_PAGE_SIZE,
        "tradingName": trading_name,
    }
    return base64.b64encode(json.dumps(params).encode()).decode()


def _parse_b3_date(date_str: str) -> datetime:
    """Parse B3's dd/mm/yyyy date format."""
    return datetime.strptime(date_str, "%d/%m/%Y")


def _parse_b3_decimal(value_str: str) -> float:
    """Parse B3's Brazilian decimal format (comma as separator)."""
    return float(value_str.replace(",", "."))


def _parse_b3_record(record: dict) -> CashDividend:
    """Convert a raw B3 JSON record into a CashDividend."""
    raw_action: str = record["corporateAction"]
    return CashDividend(
        stock_type=record["typeStock"],
        date_approval=_parse_b3_date(record["dateApproval"]),
        value_per_share=_parse_b3_decimal(record["valueCash"]),
        corporate_action=raw_action,
        label=B3_ACTION_TO_LABEL.get(raw_action, raw_action),
        last_date_prior_ex=_parse_b3_date(record["lastDatePriorEx"]),
        closing_price_prior_ex=_parse_b3_decimal(record["closingPricePriorExDate"]),
    )


def fetch_b3_dividends(
    trading_name: str, stock_type_filter: StockType | None = None
) -> list[CashDividend]:
    """
    Fetch all cash dividend records for a company from B3.

    Args:
        trading_name: The company's trading name on B3 (e.g. "PETROBRAS").
        stock_type_filter: If set, return only "ON" or "PN" records.

    Returns:
        A list of CashDividend sorted by ex-date descending (most recent first).
    """
    dividends: list[CashDividend] = []
    page = 1

    while True:
        # Step 1: encode the request params as base64
        encoded = _encode_b3_params(trading_name, page)
        url = f"{B3_BASE_URL}/{encoded}"

        # Step 2: make the HTTP request
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data: dict = response.json()

        results: list[dict] = data.get("results", [])
        if not results:
            break

        # Step 3: parse each record
        for record in results:
            dividend = _parse_b3_record(record)
            if stock_type_filter is None or dividend.stock_type == stock_type_filter:
                dividends.append(dividend)

        # Step 4: check if there are more pages
        total_pages = data.get("page", {}).get("totalPages")
        if total_pages is None or page >= total_pages:
            break
        page += 1

    return dividends


# ---------------------------------------------------------------------------
# Brapi API helpers (for validation only)
# ---------------------------------------------------------------------------

BRAPI_BASE_URL = "https://brapi.dev/api/quote"


def _parse_brapi_date(iso_str: str | None) -> datetime | None:
    """Parse Brapi's ISO 8601 date format. Returns None if input is None."""
    if iso_str is None:
        return None
    return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).replace(tzinfo=None)


def fetch_brapi_dividends(ticker: str) -> list[BrapiDividend]:
    """
    Fetch cash dividends from Brapi for a given ticker.

    This is used only for cross-referencing / validation against B3 data.
    """
    url = f"{BRAPI_BASE_URL}/{ticker}"
    response = requests.get(url, params={"dividends": "true"}, timeout=15)
    response.raise_for_status()
    data: dict = response.json()

    cash_dividends: list[dict] = (
        data.get("results", [{}])[0].get("dividendsData", {}).get("cashDividends", [])
    )

    return [
        BrapiDividend(
            label=d["label"],
            rate=d["rate"],
            approved_on=_parse_brapi_date(d["approvedOn"]),
            last_date_prior=_parse_brapi_date(d["lastDatePrior"]),
        )
        for d in cash_dividends
    ]


# ---------------------------------------------------------------------------
# Comparison logic
# ---------------------------------------------------------------------------


def compare_sources(
    b3_dividends: list[CashDividend],
    brapi_dividends: list[BrapiDividend],
) -> None:
    """
    Compare B3 and Brapi dividend data side by side.

    Matches records by (label, approval date, ex-date) and checks value differences.
    """
    # Build a lookup from Brapi: (label, approval_date, ex_date) -> rate
    brapi_lookup: dict[tuple[str, str, str], float] = {}
    skipped = 0
    for d in brapi_dividends:
        if d.approved_on is None or d.last_date_prior is None:
            skipped += 1
            continue
        key = (
            d.label,
            d.approved_on.strftime("%Y-%m-%d"),
            d.last_date_prior.strftime("%Y-%m-%d"),
        )
        brapi_lookup[key] = d.rate
    if skipped:
        print(f"  (Skipped {skipped} Brapi records with missing dates)")

    matched = 0
    mismatched = 0
    b3_only = 0

    for d in b3_dividends:
        key = (
            d.label,
            d.date_approval.strftime("%Y-%m-%d"),
            d.last_date_prior_ex.strftime("%Y-%m-%d"),
        )
        brapi_rate = brapi_lookup.pop(key, None)

        if brapi_rate is None:
            b3_only += 1
            continue

        # Compare values with tolerance for floating point
        if abs(d.value_per_share - brapi_rate) < 0.0001:
            matched += 1
        else:
            mismatched += 1
            print(
                f"  MISMATCH: {d.label} approved {d.date_approval:%Y-%m-%d} "
                f"| B3: {d.value_per_share:.8f} vs Brapi: {brapi_rate:.8f}"
            )

    brapi_only = len(brapi_lookup)

    print(f"\n  Matched:    {matched}")
    print(f"  Mismatched: {mismatched}")
    print(f"  B3 only:    {b3_only}")
    print(f"  Brapi only: {brapi_only}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    # Configuration
    trading_name = "PETROBRAS"  # company name on B3
    ticker = "PETR4"  # ticker to compare on Brapi
    stock_type: StockType = "PN"  # PETR4 = preferred shares (PN)

    print(f"=== Fetching dividends for {trading_name} ({ticker}) from B3 ===\n")

    # Step 1: fetch all PN dividends from B3
    b3_dividends = fetch_b3_dividends(trading_name, stock_type_filter=stock_type)
    print(f"B3 records found: {len(b3_dividends)}\n")

    # Step 2: display the B3 data grouped by type
    dividendos = [d for d in b3_dividends if d.label == "DIVIDENDO"]
    jcps = [d for d in b3_dividends if d.label == "JCP"]
    rendimentos = [d for d in b3_dividends if d.label == "RENDIMENTO"]

    for group_name, group in [
        ("DIVIDENDO", dividendos),
        ("JCP", jcps),
        ("RENDIMENTO", rendimentos),
    ]:
        if not group:
            continue
        total = sum(d.value_per_share for d in group)
        print(f"--- {group_name} ({len(group)} events) ---")
        for d in group:
            print(
                f"  {d.date_approval:%Y-%m-%d}  "
                f"Ex: {d.last_date_prior_ex:%Y-%m-%d}  "
                f"R$ {d.value_per_share:.8f}"
            )
        print(f"  Total: R$ {total:.4f}\n")

    total_all = sum(d.value_per_share for d in b3_dividends)
    print(f"TOTAL (all types): R$ {total_all:.4f}\n")

    # Step 3: fetch Brapi data and compare
    print(f"=== Comparing with Brapi ({ticker}) ===\n")

    brapi_dividends = fetch_brapi_dividends(ticker)
    print(f"Brapi records found: {len(brapi_dividends)}")

    compare_sources(b3_dividends, brapi_dividends)


if __name__ == "__main__":
    main()

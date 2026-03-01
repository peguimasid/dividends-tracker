// ---------------------------------------------------------------------------
// B3 API response types
// ---------------------------------------------------------------------------

/** Pagination metadata returned by paginated B3 endpoints. */
export interface B3Page {
  pageNumber: number;
  pageSize: number;
  totalRecords: number | null;
  totalPages: number | null;
}

/** A listed company returned by GetInitialCompanies. */
export interface B3Company {
  codeCVM: string;
  issuingCompany: string;
  companyName: string;
  tradingName: string;
  cnpj: string;
  marketIndicator: string;
  typeBDR: string;
  dateListing: string;
  status: string;
  segment: string;
  segmentEng: string;
  type: string;
  market: string;
}

/** Paginated response wrapper used by GetInitialCompanies. */
export interface B3CompanyResponse {
  page: B3Page;
  results: B3Company[];
}

/**
 * A cash dividend record from GetListedCashDividends (historical endpoint).
 *
 * This endpoint returns the full history (decades of data) but requires
 * pagination and a prior call to resolve the tradingName.
 */
export interface B3HistoricalDividend {
  typeStock: "ON" | "PN";
  dateApproval: string;
  valueCash: string;
  ratio: string;
  corporateAction: string;
  lastDatePriorEx: string;
  dateClosingPricePriorExDate: string;
  closingPricePriorExDate: string;
  quotedPerShares: string;
  corporateActionPrice: string;
  lastDateTimePriorEx: string;
}

/** Paginated response wrapper used by GetListedCashDividends. */
export interface B3HistoricalDividendResponse {
  page: B3Page;
  results: B3HistoricalDividend[];
}

/**
 * A cash dividend record from GetListedSupplementCompany (supplement endpoint).
 *
 * This endpoint returns only recent data (~1 year) but includes richer fields
 * like paymentDate, relatedTo, and isinCode. No pagination needed.
 */
export interface B3CashDividend {
  assetIssued: string;
  paymentDate: string;
  rate: string;
  relatedTo: string;
  approvedOn: string;
  isinCode: string;
  label: string;
  lastDatePrior: string;
  remarks: string;
}

/** A stock dividend (split, reverse split, bonus) from the supplement endpoint. */
export interface B3StockDividend {
  assetIssued: string;
  factor: string;
  approvedOn: string;
  isinCode: string;
  label: string;
  lastDatePrior: string;
  remarks: string;
}

/** A subscription event from the supplement endpoint. */
export interface B3Subscription {
  assetIssued: string;
  percentage: string;
  priceUnit: string;
  tradingPeriod: string;
  subscriptionDate: string;
  approvedOn: string;
  isinCode: string;
  label: string;
  lastDatePrior: string;
  remarks: string;
}

/** Full response from GetListedSupplementCompany. */
export interface B3SupplementCompany {
  stockCapital: string;
  quotedPerSharSince: string;
  commonSharesForm: string;
  preferredSharesForm: string;
  hasCommom: string;
  hasPreferred: string;
  roundLot: string;
  tradingName: string;
  numberCommonShares: string;
  numberPreferredShares: string;
  totalNumberShares: string;
  code: string;
  codeCVM: string;
  segment: string;
  cashDividends: B3CashDividend[];
  stockDividends: B3StockDividend[];
  subscriptions: B3Subscription[];
}

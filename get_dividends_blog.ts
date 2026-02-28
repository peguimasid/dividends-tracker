// Interfaces para as respostas da API da B3

interface B3Page {
  pageNumber: number;
  pageSize: number;
  totalRecords: number | null;
  totalPages: number | null;
}

interface B3Company {
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

interface B3CompanyResponse {
  page: B3Page;
  results: B3Company[];
}

interface B3CashDividend {
  typeStock: string;
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

interface B3DividendResponse {
  page: B3Page;
  results: B3CashDividend[];
}

// Params para as requisições

interface CompanySearchParams {
  language: string;
  pageNumber: number;
  pageSize: number;
  company: string;
}

interface DividendSearchParams {
  language: string;
  pageNumber: number;
  pageSize: number;
  tradingName: string;
}

// URLs base da API da B3
const B3_COMPANIES_URL =
  "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetInitialCompanies/";
const B3_DIVIDENDS_URL =
  "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedCashDividends/";

// Codifica os parâmetros como JSON e depois em base64
function encodeParams(params: CompanySearchParams | DividendSearchParams): string {
  return btoa(JSON.stringify(params));
}

// Função para buscar o trading name
async function getTradingName(ticker: string): Promise<string> {
  const params: CompanySearchParams = {
    language: "pt-br",
    pageNumber: 1,
    pageSize: 20,
    company: ticker,
  };

  const response = await fetch(B3_COMPANIES_URL + encodeParams(params));
  const data: B3CompanyResponse = await response.json();

  // Retorna o trading name da empresa (é necessário remover pontos e barras)
  const match = data.results.find(
    (company) => company.issuingCompany.toLowerCase() === ticker.toLowerCase()
  );

  if (!match) {
    throw new Error("Empresa não encontrada");
  }

  return match.tradingName.replaceAll("/", "").replaceAll(".", "");
}

// Função para obter os proventos
async function proventos(ticker: string): Promise<B3CashDividend[]> {
  const tradingName = await getTradingName(ticker);
  const results: B3CashDividend[] = [];
  let page = 1;

  while (true) {
    const params: DividendSearchParams = {
      language: "pt-br",
      pageNumber: page,
      pageSize: 20,
      tradingName,
    };

    const response = await fetch(B3_DIVIDENDS_URL + encodeParams(params));
    const text = await response.text();

    if (!text) break;

    const data: B3DividendResponse = JSON.parse(text);

    if (data.results.length === 0) break;

    results.push(...data.results);
    page++;
  }

  return results;
}

// Main
async function main(): Promise<void> {
  const dividends = await proventos("petr");
  console.log(dividends);
}

main();

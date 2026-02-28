import json

import requests
from base64 import b64encode

# Reutiliza a mesma sessão HTTP para manter cookies e evitar bloqueio por rate-limit
session = requests.Session()


# Função para buscar o trading name
def get_trading_name(ticker: str) -> str:
    # cria os parâmetros
    params: dict[str, str | int] = {
        "language": "pt-br",
        "pageNumber": 1,
        "pageSize": 20,
        "company": ticker,
    }

    # codifica os parâmetros como JSON e depois em base64
    string: str = b64encode(json.dumps(params).encode()).decode()

    # faz a requisição com os parâmetros
    r: requests.Response = session.get(
        r"https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetInitialCompanies/"
        + string,
    )

    # retorna o trading name da empresa, (é necessário remover pontos e barras)
    for i in r.json()["results"]:
        if i["issuingCompany"].lower() == ticker.lower():
            return i["tradingName"].replace("/", "").replace(".", "")

    # Se a empresa não for encontrada, retorna a mensagem de erro
    raise ValueError("Empresa não encontrada")


# Função para obter os proventos
def proventos(ticker: str) -> list[dict[str, str]]:
    trading_name: str = get_trading_name(ticker)
    results: list[dict[str, str]] = []
    n: int = 1
    while True:
        # cria os parâmetros com o trading name
        params: dict[str, str | int] = {
            "language": "pt-br",
            "pageNumber": n,
            "pageSize": 20,
            "tradingName": trading_name,
        }

        # codifica os parâmetros como JSON e depois em base64
        string: str = b64encode(json.dumps(params).encode()).decode()

        r: requests.Response = session.get(
            "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedCashDividends/"
            + string,
        )

        if not r.text:
            break

        data: dict[str, list[dict[str, str]]] = r.json()
        if not data["results"]:
            break

        results += data["results"]
        n += 1
    return results


print(proventos("petr"))

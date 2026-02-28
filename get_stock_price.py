import yfinance as yf
from datetime import datetime, timedelta

ticker = yf.Ticker("PETR4.SA")
info = ticker.info

print(f"Stock: {info.get('shortName', 'N/A')}")
print(f"Current Price: R$ {info.get('currentPrice', 'N/A')}")
print(f"Previous Close: R$ {info.get('previousClose', 'N/A')}")
print(f"Day High: R$ {info.get('dayHigh', 'N/A')}")
print(f"Day Low: R$ {info.get('dayLow', 'N/A')}")

print("\n--- Dividends (Last 5 Years) ---\n")

start_date = (datetime.now() - timedelta(days=5 * 365)).strftime("%Y-%m-%d")
end_date = datetime.now().strftime("%Y-%m-%d")

dividends = ticker.dividends[start_date:end_date]

if dividends.empty:
    print("No dividends found for this period.")
else:
    total = 0
    for date, value in dividends.items():
        print(f"{date.strftime('%Y-%m-%d')} - R$ {value:.4f}")
        total += value
    print(f"\nTotal dividends (last 5 years): R$ {total:.4f}")

# https://query1.finance.yahoo.com/v8/finance/chart/BBAS3.SA?period1=1456444800&period2=1772150400&events=div&interval=1mo

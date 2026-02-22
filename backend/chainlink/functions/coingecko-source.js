// Trende Chainlink Functions - CoinGecko Market Data Fetcher
// Fetches price and market metrics for a crypto asset to verify market signals
// This runs inside the Chainlink DON (Decentralized Oracle Network)

const coinId = args[0]; // e.g., "monad" or "bitcoin"
const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}&order=market_cap_desc&per_page=1&page=1&sparkline=false`;

console.log(`Fetching from CoinGecko: ${url}`);

const response = await Functions.makeHttpRequest({
    url: url,
    headers: {
        "Content-Type": "application/json"
    }
});

if (response.error) {
    console.error(response.error);
    throw Error("Request failed");
}

const data = response.data;

if (!data || data.length === 0) {
    return Functions.encodeString("No market data found");
}

const coin = data[0];
const result = JSON.stringify({
    name: coin.name,
    symbol: coin.symbol,
    price_usd: coin.current_price,
    market_cap: coin.market_cap,
    price_change_24h: coin.price_change_percentage_24h,
    verified: true,
    source: "CoinGecko"
});

return Functions.encodeString(result);

// Trende Chainlink Functions - GDELT Source Fetcher
// Fetches the top article for a query from GDELT and returns a summary
// This runs inside the Chainlink DON (Decentralized Oracle Network)

const query = args[0];
const limit = "1"; // For oracle consensus, we just need the top verifiable fact
const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=${limit}&sort=DateDesc`;

console.log(`Fetching from GDELT: ${url}`);

const gdeltResponse = await Functions.makeHttpRequest({
  url: url,
  headers: {
    "Content-Type": "application/json"
  }
});

if (gdeltResponse.error) {
  console.error(gdeltResponse.error);
  throw Error("Request failed");
}

const data = gdeltResponse.data;

if (!data || !data.articles || data.articles.length === 0) {
    return Functions.encodeString("No data found");
}

const article = data.articles[0];
const title = article.title;
const urlSource = article.url;
const sourceDomain = article.domain;
const date = article.seendate;

// Construct a verifiable string payload
const result = JSON.stringify({
    title: title,
    url: urlSource,
    source: sourceDomain,
    timestamp: date,
    verified: true
});

return Functions.encodeString(result);

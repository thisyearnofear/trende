// Trende Chainlink Functions - Oracle Resolution Script
// Fetches the AI consensus score for a specific topic to resolve a prediction market
// This runs inside the Chainlink DON (Decentralized Oracle Network)

const topic = args[0];
// In a production environment, this would call the Trende API with an attestation check.
// For the hackathon, we fetch the consensus from the Trende public endpoint or a simulated result.
const url = `https://api.trende.famile.xyz/api/consensus/resolve?topic=${encodeURIComponent(topic)}`;

console.log(`Resolving market for topic: ${topic}`);

const response = await Functions.makeHttpRequest({
    url: url,
    headers: {
        "Content-Type": "application/json"
    }
});

if (response.error) {
    console.error(response.error);
    throw Error("Consensus retrieval failed");
}

const data = response.data;
const score = Math.round((data.agreement_score || 0.5) * 100); // Scale to 0-100
const summary = data.top_narrative || "Consensus reached via multi-model AI analysis.";

console.log(`Score: ${score}, Summary: ${summary}`);

// We return a JSON string that the contract can either emit or parse.
// To keep Solidity decoding simple, we return a string "score|summary"
const result = `${score}|${summary}`;

return Functions.encodeString(result);

# Trende Chainlink Functions - Verifiable Data Source

This directory contains the JavaScript source code for Chainlink Functions used by Trende to verifiably source trend data.

## `gdelt-source.js`
This script runs on the Chainlink DON to fetch the latest news from GDELT.

**Usage:**
1. **Query**: The search term (e.g., "AI Agents").
2. **Output**: A JSON string containing the title, URL, domain, and timestamp of the top article.
3. **Verification**: The result is signed by the DON nodes, providing cryptographic proof that the data was fetched from GDELT at the time of execution.

## Integration
These scripts are deployed to the `TrendeFunctionsConsumer` contract.
The `ChainlinkConnector` in `backend/integrations/connectors/chainlink.py` submits the on-chain request via `sendRequest`.
Fulfillment is asynchronous, so runtime traces use the tx hash first, then callback data when available.

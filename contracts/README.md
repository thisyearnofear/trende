# Trende Contracts

Smart contracts for the Chainlink Functions integration.

## Contents

- `src/TrendeFunctionsConsumer.sol`: Sends Functions requests and stores callback response/error.
- `src/TrendeOracle.sol`: Market-oriented oracle contract using Chainlink Functions.
- `script/DeployTrende.s.sol`: Foundry deployment script for Base Sepolia.

## Prerequisites

1. Install Foundry: https://book.getfoundry.sh/getting-started/installation
2. Install JS deps for Chainlink contracts:

```bash
cd contracts
npm install
```

3. Install `forge-std` (not committed to keep repo lean):

```bash
cd contracts
forge install foundry-rs/forge-std
```

## Build

```bash
cd contracts
forge build
```

## Deploy (Base Sepolia)

```bash
cd contracts
forge script script/DeployTrende.s.sol:DeployTrende \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

Set required env vars before deploy:

- `PRIVATE_KEY`
- `CHAINLINK_SUBSCRIPTION_ID`

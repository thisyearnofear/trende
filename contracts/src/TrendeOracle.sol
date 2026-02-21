// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title TrendeOracle
 * @notice On-chain social trend prediction market oracle powered by Trende AI consensus.
 */
contract TrendeOracle is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    struct Market {
        bytes32 marketId;
        string topic;
        uint256 endTime;
        bool resolved;
        uint256 outcomeScore; // 0-100, representing 0.00-1.00 confidence
        string summary;
    }

    mapping(bytes32 => Market) public markets;
    bytes32[] public marketIds;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit = 300000;
    bytes32 public donId;

    event MarketCreated(bytes32 indexed marketId, string topic, uint256 endTime);
    event MarketResolved(bytes32 indexed marketId, uint256 score, string summary);
    event Response(bytes32 indexed requestId, bytes response, bytes err);

    error UnexpectedRequestID(bytes32 requestId);

    constructor(
        address router, 
        uint64 _subscriptionId,
        bytes32 _donId
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        subscriptionId = _subscriptionId;
        donId = _donId;
    }

    function createMarket(string memory topic, uint256 duration) external onlyOwner returns (bytes32) {
        bytes32 marketId = keccak256(abi.encodePacked(topic, block.timestamp));
        markets[marketId] = Market({
            marketId: marketId,
            topic: topic,
            endTime: block.timestamp + duration,
            resolved: false,
            outcomeScore: 0,
            summary: ""
        });
        marketIds.push(marketId);
        emit MarketCreated(marketId, topic, block.timestamp + duration);
        return marketId;
    }

    /**
     * @notice Send a request to resolve a market using Trende AI Consensus via Chainlink Functions
     * @param source JavaScript source code to execute off-chain
     * @param encryptedSecretsUrls Encrypted URLs where secrets can be found
     * @param args List of arguments accessible from within the source code
     */
    function resolveMarket(
        string memory source,
        bytes memory encryptedSecretsUrls,
        string[] memory args
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        if (encryptedSecretsUrls.length > 0)
            req.addSecretsReference(encryptedSecretsUrls);
        if (args.length > 0) req.setArgs(args);

        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            callbackGasLimit,
            donId
        );

        return s_lastRequestId;
    }

    /**
     * @notice Store latest result/error
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId);
        }
        s_lastResponse = response;
        s_lastError = err;
        emit Response(requestId, response, err);
        
        // In a real implementation, we would decode the response to update the market
        // But for hackathon demonstration, we emit the event
    }
}

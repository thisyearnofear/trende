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

    mapping(bytes32 => bytes32) public requestToMarket;
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
     * @notice Send a request to resolve a market
     * @param marketId The ID of the market to resolve
     * @param source JavaScript source code
     * @param encryptedSecretsUrls Encrypted secrets
     */
    function resolveMarket(
        bytes32 marketId,
        string memory source,
        bytes memory encryptedSecretsUrls
    ) external onlyOwner returns (bytes32 requestId) {
        Market storage market = markets[marketId];
        require(!market.resolved, "Market already resolved");
        
        string[] memory args = new string[](1);
        args[0] = market.topic;

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        if (encryptedSecretsUrls.length > 0)
            req.addSecretsReference(encryptedSecretsUrls);
        req.setArgs(args);

        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            callbackGasLimit,
            donId
        );

        requestToMarket[s_lastRequestId] = marketId;
        return s_lastRequestId;
    }

    /**
     * @notice Store latest result and update market
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        s_lastResponse = response;
        s_lastError = err;
        emit Response(requestId, response, err);

        bytes32 marketId = requestToMarket[requestId];
        if (marketId != bytes32(0) && err.length == 0) {
            string memory result = string(response);
            (uint256 score, string memory summary) = splitResponse(result);
            
            Market storage market = markets[marketId];
            market.outcomeScore = score;
            market.summary = summary;
            market.resolved = true;
            
            emit MarketResolved(marketId, score, summary);
        }
    }

    /**
     * @dev Helper to split "score|summary" string
     */
    function splitResponse(string memory str) internal pure returns (uint256, string memory) {
        bytes memory b = bytes(str);
        uint256 pivot = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == "|") {
                pivot = i;
                break;
            }
        }
        
        if (pivot == 0) return (0, str);

        bytes memory scoreBytes = new bytes(pivot);
        for (uint256 i = 0; i < pivot; i++) {
            scoreBytes[i] = b[i];
        }
        
        uint256 score = uint2str(string(scoreBytes));
        
        bytes memory summaryBytes = new bytes(b.length - pivot - 1);
        for (uint256 i = 0; i < b.length - pivot - 1; i++) {
            summaryBytes[i] = b[pivot + 1 + i];
        }
        
        return (score, string(summaryBytes));
    }

    function uint2str(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (uint8(b[i]) >= 48 && uint8(b[i]) <= 57) {
                result = result * 10 + (uint8(b[i]) - 48);
            }
        }
        return result;
    }
}

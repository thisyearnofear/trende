// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title TrendeFunctionsConsumer
 * @notice This contract is used to request and receive trend data from GDELT or CoinGecko
 * using Chainlink Functions.
 */
contract TrendeFunctionsConsumer is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    error UnexpectedRequestID(bytes32 requestId);

    event Response(bytes32 indexed requestId, bytes response, bytes err);

    constructor(address router) FunctionsClient(router) {}

    /**
     * @notice Send a simple request
     * @param source JavaScript source code
     * @param encryptedSecretsUrls Encrypted URLs where secrets can be found
     * @param donationAmount Amount of DON to donate to the router
     * @param args List of arguments accessible from within the source code
     * @param subscriptionId Billing subscription ID
     * @param callbackGasLimit Gas limit for the callback
     */
    function sendRequest(
        string memory source,
        bytes memory encryptedSecretsUrls,
        uint8 donationAmount,
        string[] memory args,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        bytes32 donId
    ) external returns (bytes32 requestId) {
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
     * @param requestId The requestId returned by sendRequest
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     * @dev Either response or error parameter will be set, but never both
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
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeTxDataBuilder} from "./SafeTxDataBuilder.sol";
import "forge-std/Script.sol";

contract ParseSignatures is SafeTxDataBuilder {
    function run() public {
        SafeTxData memory txData = loadSafeTxData();
        bytes32 dataHash = hashData(txData);

        // Read signatures from the file
        string[] memory signatures = readSignatures();
        address[] memory signers = new address[](signatures.length);

        // Parse each signature to extract the signer
        for (uint256 i = 0; i < signatures.length; i++) {
            bytes memory signature = vm.parseBytes(signatures[i]);
            address signer;
            bytes32 r;
            bytes32 s;
            uint8 v;

            (signer, r, s, v) = decode(dataHash, signature);
            signers[i] = signer;
        }

        // Create JSON output
        string memory jsonOutput = '{"signers":[';
        for (uint256 i = 0; i < signers.length; i++) {
            jsonOutput = string.concat(
                jsonOutput,
                '"',
                vm.toString(signers[i]),
                '"'
            );
            if (i < signers.length - 1) {
                jsonOutput = string.concat(jsonOutput, ",");
            }
        }
        jsonOutput = string.concat(jsonOutput, "]}");

        // Write to file
        vm.writeFile(string.concat(SIGNATURES_DIR, "signers.json"), jsonOutput);
    }

    function readSignatures() internal returns (string[] memory) {
        string memory content = vm.readFile(SIGNATURES_FILE);
        string[] memory lines = vm.readLines(SIGNATURES_FILE);

        // Count valid signatures
        uint256 validCount = 0;
        for (uint256 i = 0; i < lines.length; i++) {
            if (bytes(lines[i]).length > 0) {
                validCount++;
            }
        }

        // Create array of valid signatures
        string[] memory signatures = new string[](validCount);
        uint256 index = 0;
        for (uint256 i = 0; i < lines.length; i++) {
            if (bytes(lines[i]).length > 0) {
                signatures[index] = lines[i];
                index++;
            }
        }

        return signatures;
    }
}

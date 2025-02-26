# Safer

Safer is a tool that helps you sign & submit transactions to a Safe, without requiring any interaction with Safe's backend or frontend.

Safer is a set of Foundry scripts that can be used as fallback in case Safe App is down and the blockchain is the only thing that can be trusted.

Safer enables submitting complex transactions without the need of intermediaries.

**Safer unlocks true DAO resilience.**

## Getting Started

- Install [Foundry](https://github.com/foundry-rs/foundry).
- Run `make` to initialize the repository.
- Create a `.env` file from the template [`.env.example`](./.env.example) file.
  - Set the environment variable `SENDER` to the address used to execute the transaction on the Safe. If you don't execute the tx, you don't need to set it.
  - Use the environment variable `SAFE_NONCE` to override a transaction's nonce. Remove it to use the default, latest Safe nonce. Leave it blank to use nonce 0.
  - Use the environment variable `FOUNDRY_ETH_RPC_URL` to customize the RPC endpoint used. This is useful to interact with a Safe deployed on another chain than Ethereum mainnet (the default one).

### Build a Safe tx

- Run `make tx` and follow the steps to create a Safe transaction using [create-safe-tx](https://github.com/morpho-labs/create-safe-tx); OR
- Put the transaction's raw data in `data/tx.json`

### Sign a Safe tx

1. To sign the data with a Ledger, run: `make sign:ledger`
2. Share the content of `data/signatures.txt` with the signer who will execute the transaction on the Safe

### Batch signatures and execute transaction

1. Make sure at least `threshold` signatures are available in `data/signatures.txt`, each one per line
2. To execute the transaction on the Safe with a Ledger, run: `make exec:ledger`

## Multisig Workflow

This section explains how multiple signers can collaborate to sign and execute a transaction using a sequential workflow.

### Using the CLI

#### 1. Transaction Creation (Proposer)

1. Run `make tx` to create the transaction
2. The transaction data is saved to `data/tx.json`
3. Share this file with all signers (e.g., via secure file sharing, email, or git repository)

#### 2. First Signer

1. Place the shared `tx.json` file in their `data/` directory
2. Run `make sign:ledger` (or another signing method)
3. A signature is added to `data/signatures.txt`
4. Share the updated `signatures.txt` file with the next signer

#### 3. Subsequent Signers

1. Place both the original `tx.json` and the current `signatures.txt` files in their `data/` directory
2. Run `make sign:ledger` (or preferred signing method)
3. Their signature is appended to `signatures.txt`
4. Share the updated `signatures.txt` file with the next signer

#### 4. Final Execution (After Threshold is Reached)

1. The designated executor places the final `tx.json` and `signatures.txt` files in their `data/` directory
2. Verify that enough signatures are collected by running `make check`
3. Run `make exec:ledger` to submit the transaction to the blockchain
4. The transaction hash is displayed and can be shared with all signers

### Using the Web Interface

#### 1. Transaction Creation (Proposer)

1. Start the server with `npm run dev` or `npm start`
2. Fill out the transaction details in the "Build Transaction" tab and submit
3. Share the URL with all signers (contains the transaction hash and Safe address)

#### 2. Signers (In Sequence or Parallel)

1. Each signer visits the shared URL
2. Clicks the "Sign & Execute" tab
3. Connects their hardware wallet using the "Connect Wallet" button
4. Signs the transaction directly in their browser
5. The signature is automatically stored on the server

#### 3. Monitoring Progress

1. All signers can see the current signature status on the "Sign & Execute" tab
2. The progress bar shows how many signatures have been collected
3. The list of owners shows who has signed and who hasn't

#### 4. Execution

1. Once enough signatures are collected (threshold is reached), the "Execute Transaction" button becomes enabled
2. Any signer can click this button to execute the transaction
3. The transaction hash and Etherscan link are displayed for verification

### Remote Collaboration Options

For teams working remotely, here are recommended ways to share the transaction files:

1. **Git Repository**: Create a branch for each transaction with the required files
2. **Secure File Sharing**: Use services like Keybase, Signal, or other encrypted file sharing
3. **Self-hosted Server**: Deploy the web interface on a secure server accessible to all signers
4. **Email**: For less sensitive transactions, encrypted email can be used to share files

### Verification Between Steps

To verify the transaction details at any point:

1. **CLI**: Run `make show` to display the current transaction details and signatures
2. **Web**: The transaction details and current signatures are always visible in the interface

### Troubleshooting

If signatures are being rejected:

1. Ensure all signers are using the exact same `tx.json` file
2. Verify that the Safe address and network are the same for all signers
3. Check that signers are using wallets connected to the addresses registered in the Safe

## CLI and Webapp Integration

The CLI tools and web interface in Safer are not separate systems but complementary interfaces to the same underlying functionality. This design provides flexibility and resilience for multisig operations.

### Shared Components

1. **Common Data Files**

   - Both interfaces read from and write to the same files:
     - `data/tx.json` for transaction data
     - `data/signatures.txt` for collected signatures

2. **Underlying Foundry Scripts**

   - The webapp executes the same Foundry scripts that the CLI uses
   - For example, when you click "Build Transaction" in the webapp, it runs the same script as `make tx`

3. **Shared Configuration**
   - Both use the same `.env` file for environment variables

### Flexible Workflows

This integration allows for mixed workflows where you can:

1. **Combine approaches based on preference**:

   - Build a transaction in the CLI but collect signatures via the webapp
   - Create a transaction via the webapp but execute it through CLI
   - Switch between interfaces at any point in the process

2. **Accommodate different user types**:

   - Technical users can stick with CLI
   - Non-technical users can use the webapp
   - Mixed teams can each use their preferred interface

3. **Provide redundancy**:
   - If the webapp server is down, you can fall back to CLI
   - If access to terminal is limited, you can use the webapp

### Example Mixed Workflow

Here's how a team might use both interfaces in a single transaction:

1. Developer creates transaction via CLI with `make tx`
2. Shares the data directory with other signers
3. Non-technical signers use the webapp to connect hardware wallets and sign
4. Technical signers might use CLI commands like `make sign:ledger`
5. Final execution could be done through either interface

This integrated design eliminates single points of failure and supports Safer's goal of "true DAO resilience" by providing multiple ways to interact with Safe transactions.

## Web Frontend

A user-friendly web interface is available for interacting with Safer through any modern browser. This provides a complete solution for building, signing, and executing Safe transactions without using command-line tools.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- npm (usually comes with Node.js)
- All the Foundry requirements mentioned above

### Installation

1. Clone this repository and change into its directory:

   ```
   git clone <repository-url>
   cd safer
   ```

2. Install the required Node.js dependencies:

   ```
   npm install
   ```

3. Make sure Foundry is initialized:
   ```
   make
   ```

### Running Locally

1. Start the development server:

   ```
   npm run dev
   ```

   For production environments:

   ```
   npm run build
   npm start
   ```

2. Open your browser and navigate to:

   ```
   http://localhost:3000
   ```

3. Use the web interface to:
   - Create and build Safe transactions
   - Connect hardware wallets directly in the browser
   - Sign transactions with Ledger or Trezor
   - Monitor signature collection progress
   - Execute transactions when threshold is reached

### Environment Variables

The web frontend uses the following environment variables (set in your `.env` file):

| Variable              | Description                                               | Default                        |
| --------------------- | --------------------------------------------------------- | ------------------------------ |
| `PORT`                | Port number for the web server                            | `3000`                         |
| `SAFE`                | Address of the Safe contract                              | Required                       |
| `SENDER`              | Address that will execute the transaction                 | Required for execution         |
| `SAFE_NONCE`          | Specific nonce to use for the transaction                 | `latest` (uses next available) |
| `FOUNDRY_ETH_RPC_URL` | RPC endpoint for the blockchain connection                | `https://eth.llamarpc.com`     |
| `SKIP_SENDER_WARNING` | Set to any value to disable warnings about missing sender | Not set                        |

### Hardware Wallet Support

The web frontend includes direct integration with hardware wallets:

- **Ledger**: Connect and sign transactions directly in your browser
- **Trezor**: Connect and sign transactions directly in your browser
- **Other Wallets**: Any injected wallet like MetaMask is also supported

The integration works by:

1. Connecting to your device through Web3-Onboard
2. Signing the transaction hash directly in the browser
3. Storing the signature alongside others from the multisig

This enables a completely browser-based workflow for all signers in a multisig, without requiring command-line tools or technical knowledge.

### Multisig Support

The web interface provides full support for multisig Safe transactions:

- Displays the required threshold and total number of owners
- Shows a progress bar of collected signatures
- Lists each owner with their signing status
- Prevents execution until the threshold is met
- Automatically refreshes the signature status

### Integration with Foundry Scripts

Behind the scenes, the web frontend works by:

1. Collecting transaction parameters through a web form
2. Writing the data to `data/tx.json` in the format expected by the Safer scripts
3. Running the appropriate Foundry scripts in the background
4. Reading and displaying the output from these scripts (e.g., transaction hashes)

All of the underlying functionality still relies on the Foundry scripts, but the frontend provides a more accessible interface for users who prefer not to use the command line.

## Advanced options

### Hardware Wallet support

With `make sign` & `make exec`, one can also use any other wallet provider available with `cast`:

- `make cmd:interactive` to input the private key to the command prompt
- `make cmd:ledger` to use a Ledger
- `make cmd:trezor` to use a Trezor
- `make cmd:keystore` to use a keystore
- `make cmd:"private-key 0x..."` if you really want to save your private key to your shell's history...

You can also append any `cast` parameter:
- `make sign:"ledger --mnemonic 1 --mnemonic-index 1"` or `make exec:"ledger --mnemonics foo --mnemonic-indexes 1"` to use another account than the default one at index `0`

### Transaction details

```json
{
  "to": "0x0000000000000000000000000000000000000000",
  "value": "0", // The tx value (in ETH), must be a string
  "data": "0x", // The raw tx data, must start with 0x
  "operation": 0, // 0 for a call, 1 for a delegatecall
  "safeTxGas": 0,
  "baseGas": 0,
  "gasPrice": 0,
  "gasToken": "0x0000000000000000000000000000000000000000", // Indicates the tx will consume the chain's default gas token (ETH on mainnet)
  "refundReceiver": "0x0000000000000000000000000000000000000000" // Indicates the tx's refund receiver will be the address executing the tx
}
```

### Customizing Network Support

By default, the frontend supports Ethereum Mainnet, Goerli, and Polygon. To add support for additional networks:

1. Edit the chains array in the `initWeb3Onboard` function in `index.html`
2. Add your network with the appropriate chain ID, token, and RPC URL

### Deploying in Production

For production deployment, we recommend:

1. Using a reverse proxy like Nginx in front of the Node.js server
2. Setting up HTTPS with a valid SSL certificate
3. Using environment variables for sensitive configuration
4. Setting up process management with PM2 or similar

Example PM2 startup command:

```
pm2 start npm --name "safer" -- start
```

## Development and Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

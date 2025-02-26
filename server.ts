import express from "express";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import multer from "multer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const execPromise = promisify(exec);
const app = express();
const port = process.env.PORT || 3000;
const rpcUrl = process.env.FOUNDRY_ETH_RPC_URL || "https://eth.llamarpc.com";

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dataDir = ensureDataDirExists();
    cb(null, dataDir);
  },
  filename: function (req, file, cb) {
    cb(null, "signatures.txt");
  },
});
const upload = multer({ storage: storage });

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve static files from 'public' directory

// Interface for Safe transaction data
interface SafeTxData {
  to: string;
  value: string;
  data: string;
  operation: number;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
}

// Interface for Safe details
interface SafeDetails {
  address: string;
  threshold: number;
  owners: string[];
}

// Add a global variable to store user-provided Safe address
let userProvidedSafeAddress: string | null = null;

// Helper function to get the effective Safe address
function getSafeAddress(): string {
  return process.env.SAFE || userProvidedSafeAddress || "";
}

// Helper to ensure data directory exists
const ensureDataDirExists = () => {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// Serve the HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get Safe details including threshold and owners
app.get("/safeDetails", async (req, res) => {
  try {
    const safeAddress = getSafeAddress();
    const sender = process.env.SENDER || "";
    const nonce = process.env.SAFE_NONCE || "latest";

    if (!safeAddress) {
      return res.send(`
        <h2>⚠️ Safe Address Not Configured</h2>
        <p>No Safe address has been configured. Please provide a Safe address below:</p>

        <div id="safeAddressFormInline">
          <form id="configFormInline">
            <label for="safeAddressInline">Safe Address:</label>
            <input
              type="text"
              id="safeAddressInline"
              name="safeAddressInline"
              placeholder="0x..."
              required
            />

            <button type="submit">Set Safe Address</button>
          </form>
        </div>

        <script>
          document.getElementById('configFormInline').addEventListener('submit', async function(e) {
            e.preventDefault();

            const safeAddress = document.getElementById('safeAddressInline').value;

            // Save to localStorage
            localStorage.setItem('safeAddress', safeAddress);

            // Submit to server
            const response = await fetch('/setSafeAddress', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ safeAddress })
            });

            const result = await response.json();

            if (result.success) {
              // Reload the page to show the configured Safe
              window.location.reload();
            } else {
              alert('Error saving Safe address: ' + result.error);
            }
          });
        </script>
      `);
    }

    // Get Safe details using forge script
    const command = `FOUNDRY_ETH_RPC_URL="${rpcUrl}" forge script script/GetSafeDetails.s.sol --silent`;
    console.log(`Executing: ${command}`);

    try {
      await execPromise(command);
    } catch (error) {
      console.warn("Error fetching Safe details, using defaults:", error);
      // Continue with default values if the script doesn't exist
    }

    // Try to read Safe details from file
    const dataDir = ensureDataDirExists();
    let threshold = 1;
    let owners: string[] = [];

    const safeDetailsPath = path.join(dataDir, "safeDetails.json");
    if (fs.existsSync(safeDetailsPath)) {
      const safeDetailsJson = fs.readFileSync(safeDetailsPath, "utf8");
      const safeDetails = JSON.parse(safeDetailsJson);
      threshold = safeDetails.threshold || 1;
      owners = safeDetails.owners || [];
    }

    // Add the "Change Safe" button to the HTML response
    let html = `<h2>Safe Details:</h2>
      <div class="details-row">
        <span class="label">Address:</span>
        <span class="value">${safeAddress}</span>
        <button id="changeSafeBtn" class="small-button">Change Safe</button>
      </div>`;

    // Return HTML with safe details
    html += `
      <p><strong>Required Signatures:</strong> ${threshold} of ${
      owners.length
    } owners</p>
      <p><strong>Network:</strong> ${
        rpcUrl.includes("mainnet") ? "Ethereum Mainnet" : rpcUrl
      }</p>
      <p><strong>Nonce:</strong> ${nonce}</p>
      ${
        sender
          ? `<p><strong>Transaction Sender:</strong> <span class="safe-address">${sender}</span></p>`
          : ""
      }
    `;

    // Add script for the Change Safe button
    html += `
      <script>
        document.getElementById('changeSafeBtn').addEventListener('click', async function() {
          if (confirm('Are you sure you want to change the Safe address? Any unsaved transactions will be lost.')) {
            try {
              const response = await fetch('/clearSafeAddress', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              const result = await response.json();

              if (result.success) {
                // Clear localStorage
                localStorage.removeItem('safeAddress');

                // Reload the page
                window.location.reload();
              } else {
                alert('Error clearing Safe address: ' + result.error);
              }
            } catch (error) {
              console.error('Error:', error);
              alert('An error occurred while trying to change the Safe address.');
            }
          }
        });
      </script>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error getting safe details:", error);
    res.status(500).send(`
      <div class="error">
        Error: ${error instanceof Error ? error.message : "Unknown error"}
      </div>
    `);
  }
});

// Build Safe transaction data endpoint
app.post("/buildSafeTx", async (req, res) => {
  try {
    const txData: SafeTxData = {
      to: req.body.to,
      value: req.body.value,
      data: req.body.data || "0x",
      operation: parseInt(req.body.operation) || 0,
      safeTxGas: req.body.safeTxGas || "0",
      baseGas: req.body.baseGas || "0",
      gasPrice: req.body.gasPrice || "0",
      gasToken:
        req.body.gasToken || "0x0000000000000000000000000000000000000000",
      refundReceiver:
        req.body.refundReceiver || "0x0000000000000000000000000000000000000000",
    };

    // Write to data/tx.json
    const dataDir = ensureDataDirExists();
    fs.writeFileSync(
      path.join(dataDir, "tx.json"),
      JSON.stringify(txData, null, 2)
    );

    // Clean any existing signatures
    fs.writeFileSync(path.join(dataDir, "signatures.txt"), "");

    // Run the Foundry script to calculate hash with configured RPC URL
    const command = `FOUNDRY_ETH_RPC_URL="${rpcUrl}" forge script script/HashData.s.sol`;
    console.log(`Executing: ${command}`);
    const { stdout, stderr } = await execPromise(command);

    if (stderr && !stderr.includes("warning")) {
      console.error("Hash calculation errors:", stderr);
      throw new Error(`Failed to calculate hash: ${stderr}`);
    }

    console.log("Hash calculation output:", stdout);

    // Read the hash from the file
    const hash = fs
      .readFileSync(path.join(dataDir, "hashData.txt"), "utf8")
      .trim();

    // Return the HTMX-friendly response
    res.send(`
      <h3>Transaction Data</h3>
      <pre>${JSON.stringify(txData, null, 2)}</pre>

      <h3>Transaction Hash</h3>
      <div class="hash">${hash}</div>

      <div class="actions">
        <button hx-post="/signTx" hx-target="#signatureArea">Sign Transaction</button>
        <div id="signatureArea"></div>
      </div>
    `);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(`
      <div class="error">
        <h3>Error</h3>
        <pre>${error instanceof Error ? error.message : "Unknown error"}</pre>
      </div>
    `);
  }
});

// Sign transaction endpoint
app.post("/signTx", async (req, res) => {
  try {
    // Read the current hash
    const dataDir = ensureDataDirExists();
    const hashPath = path.join(dataDir, "hashData.txt");

    if (!fs.existsSync(hashPath)) {
      throw new Error(
        "No transaction hash found. Please build a transaction first."
      );
    }

    const hash = fs.readFileSync(hashPath, "utf8").trim();

    // Get Safe details to show threshold and signature status
    let threshold = 1;
    let owners: string[] = [];
    let currentSigners: string[] = [];

    // Try to get details from saved file
    const safeDetailsPath = path.join(dataDir, "safeDetails.json");
    if (fs.existsSync(safeDetailsPath)) {
      try {
        const safeDetailsJson = fs.readFileSync(safeDetailsPath, "utf8");
        const safeDetails = JSON.parse(safeDetailsJson);
        threshold = safeDetails.threshold || 1;
        owners = safeDetails.owners || [];
      } catch (err) {
        console.warn("Error parsing safe details:", err);
      }
    }

    // Get existing signatures and extract signers
    const signaturesPath = path.join(dataDir, "signatures.txt");
    let signatureCount = 0;

    if (fs.existsSync(signaturesPath)) {
      try {
        const signaturesContent = fs.readFileSync(signaturesPath, "utf8");
        const signatures = signaturesContent
          .split("\n")
          .filter((line) => line.trim().length > 0);

        signatureCount = signatures.length;

        // Parse signers from signatures using the ParseSignatures script
        // This would require a new Foundry script to extract signers from signatures
        // For now, we'll just count the signatures

        try {
          await execPromise(
            `FOUNDRY_ETH_RPC_URL="${rpcUrl}" forge script script/ParseSignatures.s.sol --silent`
          );
          const signersPath = path.join(dataDir, "signers.json");
          if (fs.existsSync(signersPath)) {
            const signersJson = fs.readFileSync(signersPath, "utf8");
            const signersData = JSON.parse(signersJson);
            currentSigners = signersData.signers || [];
          }
        } catch (err) {
          console.warn("Failed to parse signers from signatures:", err);
        }
      } catch (err) {
        console.warn("Error reading signatures:", err);
      }
    }

    // Determine progress toward threshold
    const progress = Math.min(signatureCount, threshold);
    const progressPercent =
      threshold > 0 ? Math.floor((progress / threshold) * 100) : 0;
    const canExecute = signatureCount >= threshold;

    res.send(`
      <h3>Sign Transaction</h3>
      <p>Transaction hash: <code>${hash}</code></p>

      <div class="signature-status">
        <h4>Signature Status</h4>
        <div class="progress-bar" style="background-color: #eee; height: 20px; border-radius: 5px; margin: 10px 0;">
          <div style="background-color: ${
            canExecute ? "#4CAF50" : "#2196F3"
          }; height: 100%; width: ${progressPercent}%; border-radius: 5px;"></div>
        </div>
        <p>Current signatures: <strong>${signatureCount}</strong> of <strong>${threshold}</strong> required${
      canExecute ? " ✓" : ""
    }</p>

        ${
          owners.length > 0
            ? `
        <h4>Safe Owners</h4>
        <ul>
          ${owners
            .map(
              (owner) => `
            <li>
              ${owner}
              ${
                currentSigners.includes(owner)
                  ? ' <span style="color: green">✓ Signed</span>'
                  : ' <span style="color: gray">Not signed</span>'
              }
            </li>
          `
            )
            .join("")}
        </ul>`
            : ""
        }
      </div>

      <div class="signing-options">
        <h4>Option 1: Command Line Signing</h4>
        <p>To sign with a Ledger, run the following command:</p>
        <pre>make sign:ledger</pre>

        <p>Other options:</p>
        <pre>make sign:trezor       # Sign with Trezor
make sign:keystore     # Sign with keystore
make sign:interactive  # Sign with private key (interactive)</pre>

        <h4>Option 2: Upload Signature</h4>
        <p>If you already have a signature file or a signed transaction, upload it:</p>
        <form hx-post="/uploadSignature" hx-encoding="multipart/form-data" hx-target="#executionArea">
          <input type="file" name="signatureFile" />
          <button type="submit">Upload Signatures</button>
        </form>
      </div>
      <div id="executionArea"></div>
    `);
  } catch (error) {
    console.error("Error with signing:", error);
    res
      .status(500)
      .send(
        `<div class="error">Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }</div>`
      );
  }
});

// Upload signature file endpoint with file handling
app.post(
  "/uploadSignature",
  upload.single("signatureFile"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new Error("No file uploaded");
      }

      // The file is directly saved to data/signatures.txt by multer
      console.log(`Signature file uploaded to ${req.file.path}`);

      // Check if we have enough signatures and can execute
      const dataDir = ensureDataDirExists();
      const signaturesPath = path.join(dataDir, "signatures.txt");

      if (!fs.existsSync(signaturesPath)) {
        throw new Error("Signatures file not found");
      }

      const signaturesContent = fs.readFileSync(signaturesPath, "utf8");
      const signatures = signaturesContent
        .split("\n")
        .filter((line) => line.trim().length > 0);

      // Get threshold from Safe details if available
      let threshold = 1;
      try {
        const safeDetailsPath = path.join(dataDir, "safeDetails.json");
        if (fs.existsSync(safeDetailsPath)) {
          const safeDetailsJson = fs.readFileSync(safeDetailsPath, "utf8");
          const safeDetails = JSON.parse(safeDetailsJson);
          threshold = safeDetails.threshold || 1;
        }
      } catch (err) {
        console.warn("Error reading safe details:", err);
      }

      const signatureCount = signatures.length;
      const canExecute = signatureCount >= threshold;

      // Respond with execution UI
      res.send(`
        <h3>Signatures Uploaded</h3>
        <p>Current signature count: <strong>${signatureCount}</strong> of <strong>${threshold}</strong> required</p>

        ${
          canExecute
            ? `
        <div class="alert alert-success">
          <p>✅ You have enough signatures to execute this transaction!</p>
        </div>
        `
            : `
        <div class="alert alert-warning">
          <p>⚠️ You need ${threshold - signatureCount} more signature${
                threshold - signatureCount !== 1 ? "s" : ""
              } to execute this transaction.</p>
        </div>
        `
        }

        <h3>Execute Transaction</h3>
        <p>Ready to submit the transaction to the blockchain?</p>
        <button hx-post="/executeTx" hx-target="#result" ${
          !canExecute ? "disabled" : ""
        }>Execute Safe Transaction</button>
        ${
          !canExecute
            ? "<p><small>Button is disabled until threshold is met</small></p>"
            : ""
        }
        <div id="result"></div>
      `);
    } catch (error) {
      console.error("Error uploading signature:", error);
      res
        .status(500)
        .send(
          `<div class="error">Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }</div>`
        );
    }
  }
);

// Check current signatures endpoint
app.get("/checkSignatures", async (req, res) => {
  try {
    const dataDir = ensureDataDirExists();
    const signaturesPath = path.join(dataDir, "signatures.txt");
    const hashDataPath = path.join(dataDir, "hashData.txt");

    // Check if we have transaction data
    if (!fs.existsSync(hashDataPath)) {
      return res.send(``); // Empty if no transaction yet
    }

    // Get Safe details to know about threshold
    let threshold = 1;
    let owners: string[] = [];
    let signerAddresses: string[] = [];

    try {
      const safeDetailsPath = path.join(dataDir, "safeDetails.json");
      if (fs.existsSync(safeDetailsPath)) {
        const safeDetailsJson = fs.readFileSync(safeDetailsPath, "utf8");
        const safeDetails = JSON.parse(safeDetailsJson);
        threshold = safeDetails.threshold || 1;
        owners = safeDetails.owners || [];
      }

      // Try to read parsed signers
      const signersPath = path.join(dataDir, "signers.json");
      if (fs.existsSync(signersPath)) {
        const signersJson = fs.readFileSync(signersPath, "utf8");
        const signersData = JSON.parse(signersJson);
        signerAddresses = signersData.signers || [];
      }
    } catch (err) {
      console.warn("Error reading details:", err);
    }

    if (!fs.existsSync(signaturesPath)) {
      return res.send(`
        <h3>Signature Progress</h3>
        <p>No signatures collected yet. Transaction requires ${threshold} signatures.</p>
        <div class="progress-container">
          <div class="progress-bar" style="width: 0%">0/${threshold}</div>
        </div>
      `);
    }

    const signaturesContent = fs.readFileSync(signaturesPath, "utf8");
    const signatures = signaturesContent
      .split("\n")
      .filter((line) => line.trim().length > 0);

    // Calculate percentage for progress bar
    const percentage = Math.min(
      100,
      Math.round((signatures.length / threshold) * 100)
    );
    const canExecute = signatures.length >= threshold;

    let html = `
      <h3>Signature Progress</h3>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${percentage}%">${signatures.length}/${threshold}</div>
      </div>
    `;

    // Show owners and their signing status if we have that info
    if (owners.length > 0) {
      html += `<div class="owner-list"><h4>Safe Owners</h4>`;

      for (const owner of owners) {
        const hasSigned =
          signerAddresses.includes(owner.toLowerCase()) ||
          signerAddresses.includes(owner);

        html += `
          <div class="owner">
            <span class="owner-address">${owner}</span>
            <span class="${hasSigned ? "signed" : "unsigned"}">
              ${hasSigned ? "✅ Signed" : "⏳ Waiting"}
            </span>
          </div>
        `;
      }

      html += `</div>`;
    }

    // Add execute button if we have enough signatures
    if (canExecute) {
      html += `
        <div class="success">
          <p>✅ Required signatures collected! Ready to execute transaction.</p>
          <button hx-post="/executeTx" hx-target="#txDataDisplay">Execute Transaction Now</button>
        </div>
      `;
    } else {
      html += `
        <p>Waiting for ${threshold - signatures.length} more signature(s)...</p>
        <button disabled>Execute Transaction</button>
      `;
    }

    res.send(html);
  } catch (error) {
    console.error("Error checking signatures:", error);
    res.status(500).send(`
      <div class="error">
        Error: ${error instanceof Error ? error.message : "Unknown error"}
      </div>
    `);
  }
});

// Execute transaction endpoint
app.post("/executeTx", async (req, res) => {
  try {
    // Check if we have the necessary files
    const dataDir = ensureDataDirExists();
    const txPath = path.join(dataDir, "tx.json");
    const signaturesPath = path.join(dataDir, "signatures.txt");

    if (!fs.existsSync(txPath)) {
      throw new Error(
        "Transaction data not found. Please build a transaction first."
      );
    }

    if (!fs.existsSync(signaturesPath)) {
      throw new Error(
        "No signatures found. Please sign the transaction first."
      );
    }

    // Check if we have enough signatures
    let threshold = 1;
    try {
      const safeDetailsPath = path.join(dataDir, "safeDetails.json");
      if (fs.existsSync(safeDetailsPath)) {
        const safeDetailsJson = fs.readFileSync(safeDetailsPath, "utf8");
        const safeDetails = JSON.parse(safeDetailsJson);
        threshold = safeDetails.threshold || 1;
      }
    } catch (err) {
      console.warn("Error reading safe details:", err);
    }

    const signaturesContent = fs.readFileSync(signaturesPath, "utf8");
    const signatures = signaturesContent
      .split("\n")
      .filter((line) => line.trim().length > 0);

    if (signatures.length < threshold) {
      throw new Error(
        `Not enough signatures. Required: ${threshold}, Found: ${signatures.length}`
      );
    }

    // Use the configured RPC URL when executing the transaction
    const command = `FOUNDRY_ETH_RPC_URL="${rpcUrl}" forge script script/ExecTransaction.s.sol --broadcast`;
    console.log(`Executing: ${command}`);

    // Execute the transaction
    const { stdout, stderr } = await execPromise(command);
    console.log("Execution output:", stdout);

    if (stderr && !stderr.includes("warning")) {
      console.error("Execution errors:", stderr);
      throw new Error(`Transaction execution failed: ${stderr}`);
    }

    // Extract transaction hash if available
    let txHash = "";
    const hashMatch = stdout.match(/Transaction hash: (0x[a-fA-F0-9]{64})/);
    if (hashMatch && hashMatch[1]) {
      txHash = hashMatch[1];
    }

    // Return success with tx details
    res.send(`
      <h3>Transaction Executed</h3>
      <p>✅ Safe transaction has been successfully submitted to the blockchain.</p>
      ${
        txHash
          ? `<p>Transaction hash: <a href="https://etherscan.io/tx/${txHash}" target="_blank">${txHash}</a></p>`
          : ""
      }
      <p>Using RPC endpoint: ${rpcUrl}</p>

      <h4>Command Output</h4>
      <pre style="max-height: 200px; overflow-y: auto;">${stdout}</pre>

      <button hx-get="/" hx-push-url="true" class="mt-4">Start New Transaction</button>
    `);
  } catch (error) {
    console.error("Error executing transaction:", error);
    res.status(500).send(
      `<div class="error">
          <h3>Execution Failed</h3>
          <p>Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }</p>
          <button hx-get="/signTx" hx-target="#txDataDisplay">Back to Signing</button>
        </div>`
    );
  }
});

// Add an endpoint to serve the package in production
app.get("/js/web3-onboard.js", (req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "@web3-onboard/core/dist/index.js")
  );
});

app.get("/js/web3-onboard-ledger.js", (req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "@web3-onboard/ledger/dist/index.js")
  );
});

app.get("/js/web3-onboard-trezor.js", (req, res) => {
  res.sendFile(
    path.join(__dirname, "node_modules", "@web3-onboard/trezor/dist/index.js")
  );
});

// Add a new endpoint to receive hardware wallet signatures
app.post("/submitHardwareWalletSignature", async (req, res) => {
  try {
    const { signature } = req.body;

    if (!signature) {
      throw new Error("No signature provided");
    }

    // Write signature to file
    const dataDir = ensureDataDirExists();
    const signaturesPath = path.join(dataDir, "signatures.txt");

    // Append to existing signatures
    fs.appendFileSync(signaturesPath, signature + "\n");

    // Run the ParseSignatures script to extract signer information
    try {
      await execPromise(
        `FOUNDRY_ETH_RPC_URL="${rpcUrl}" forge script script/ParseSignatures.s.sol --silent`
      );
    } catch (err) {
      console.warn("Failed to parse signers from signatures:", err);
    }

    res.json({ success: true, message: "Signature added successfully" });
  } catch (error) {
    console.error("Error with hardware wallet signature:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Add new endpoint to check Safe configuration
app.get("/checkSafeConfig", (req, res) => {
  const safeConfigured = Boolean(process.env.SAFE || userProvidedSafeAddress);
  console.log("Safe configured check:", {
    envSafe: process.env.SAFE,
    userProvided: userProvidedSafeAddress,
    result: safeConfigured,
  });
  res.json({ safeConfigured });
});

// Add endpoint to set Safe address
app.post("/setSafeAddress", (req, res) => {
  try {
    const { safeAddress } = req.body;

    // Validate address format (basic check)
    if (!safeAddress || !safeAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.json({
        success: false,
        error: "Invalid Safe address format",
      });
    }

    // Store the address
    userProvidedSafeAddress = safeAddress;

    // Update all commands to use this address
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error setting Safe address:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.json({
      success: false,
      error: errorMessage,
    });
  }
});

// Add endpoint to clear Safe address
app.post("/clearSafeAddress", (req, res) => {
  try {
    // Clear the user-provided Safe address
    userProvidedSafeAddress = null;

    console.log("Safe address cleared");
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error clearing Safe address:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.json({
      success: false,
      error: errorMessage,
    });
  }
});

// Start the server
app.listen(port, () => {
  // Ensure data directory exists at startup
  ensureDataDirExists();

  console.log(`Server running at http://localhost:${port}`);
  console.log(`Using RPC URL: ${rpcUrl}`);

  if (!process.env.SAFE) {
    console.warn(
      "WARNING: No SAFE environment variable set. Please set it in your .env file."
    );
  }

  if (!process.env.SENDER && !process.env.SKIP_SENDER_WARNING) {
    console.warn(
      "WARNING: No SENDER environment variable set. This is required for executing transactions."
    );
  }
});

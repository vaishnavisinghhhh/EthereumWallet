/**
 * ============================================================================
 * Ethereum Wallet Explorer — Frontend Controller
 * Plain Vanilla JavaScript implementation that communicates with our
 * Node.js + Express backend service. Uses relative API paths since the
 * frontend is now served by the same Express server at http://localhost:3000.
 * ============================================================================
 */

// Global Configuration
// BACKEND_BASE_URL is empty string so API calls use the same origin as the page.
// When served from Express at http://localhost:3000, fetch("/api/...") resolves
// to http://localhost:3000/api/... automatically — no hardcoded host needed.
const CONFIG = {
  BACKEND_BASE_URL: "",
  ETHERSCAN_EXPLORER_URL: "https://etherscan.io",
};

// DOM Element References
const elements = {
  // Search and Inputs
  searchForm: document.getElementById("searchForm"),
  addressInput: document.getElementById("addressInput"),
  searchBtn: document.getElementById("searchBtn"),
  clearBtn: document.getElementById("clearBtn"),
  quickChips: document.querySelectorAll(".chip-btn"),

  // Feedback States
  emptyState: document.getElementById("emptyState"),
  loadingState: document.getElementById("loadingState"),
  loadingSubtext: document.getElementById("loadingSubtext"),
  errorState: document.getElementById("errorState"),
  errorHeading: document.getElementById("errorHeading"),
  errorMessage: document.getElementById("errorMessage"),
  errorCloseBtn: document.getElementById("errorCloseBtn"),

  // Results Section
  resultsSection: document.getElementById("resultsSection"),

  // Stat Card Elements
  ethBalanceValue: document.getElementById("ethBalanceValue"),
  ethBalanceWei: document.getElementById("ethBalanceWei"),
  txCountValue: document.getElementById("txCountValue"),
  walletAddressDisplay: document.getElementById("walletAddressDisplay"),
  copyAddressBtn: document.getElementById("copyAddressBtn"),
  viewEtherscanLink: document.getElementById("viewEtherscanLink"),

  // Transaction Elements
  txCountBadge: document.getElementById("txCountBadge"),
  txTableBody: document.getElementById("txTableBody"),
  txCardsMobile: document.getElementById("txCardsMobile"),
};

// ============================================================================
// 1. HELPER FUNCTIONS (Validation, Formatting & Math)
// ============================================================================

/**
 * Validates whether a given string is a valid Ethereum address.
 * Standard Ethereum addresses:
 * - Start with "0x"
 * - Followed by exactly 40 hexadecimal characters (0-9, a-f, A-F)
 * - Total length is exactly 42 characters
 * 
 * @param {string} address - The address string to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidEthereumAddress(address) {
  if (!address || typeof address !== "string") return false;
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address.trim());
}

/**
 * Converts a Wei amount (string or number) into Ether (ETH).
 * Uses native JavaScript BigInt to prevent floating-point precision loss with 18 decimals.
 * 
 * @param {string|number} weiStr - The balance in Wei
 * @param {number} decimalsToDisplay - Maximum decimals to show
 * @returns {string} - Formatted ETH string (e.g. "1.2345")
 */
function formatWeiToEth(weiStr, decimalsToDisplay = 4) {
  try {
    if (!weiStr || weiStr === "0") return "0";

    const cleanWei = BigInt(weiStr.toString()).toString();
    const padded = cleanWei.padStart(19, "0");
    const integerPart = padded.slice(0, padded.length - 18) || "0";
    let fractionPart = padded.slice(padded.length - 18);

    fractionPart = fractionPart.slice(0, decimalsToDisplay);
    fractionPart = fractionPart.replace(/0+$/, "");

    const formattedInteger = Number(integerPart).toLocaleString();
    return fractionPart ? `${formattedInteger}.${fractionPart}` : formattedInteger;
  } catch (err) {
    console.error("Error converting Wei to ETH:", err);
    return "0";
  }
}

/**
 * Truncates an Ethereum address or hash for compact editorial display.
 * 
 * @param {string} str - Full address or hash
 * @param {number} keepChars - Characters to keep on each side
 * @returns {string} - Shortened string
 */
function shortenAddress(str, keepChars = 4) {
  if (!str) return "N/A";
  if (str.length <= keepChars * 2 + 2) return str;
  return `${str.slice(0, keepChars + 2)}...${str.slice(-keepChars)}`;
}

/**
 * Formats a Unix timestamp (in seconds) into a readable human date & relative time.
 * 
 * @param {number|string} unixSeconds - Timestamp in seconds
 * @returns {object} - { dateString, relativeString }
 */
function formatTimestamp(unixSeconds) {
  if (!unixSeconds) return { dateString: "Unknown", relativeString: "" };

  const date = new Date(Number(unixSeconds) * 1000);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  let relativeString = "";
  if (diffInSeconds < 60) {
    relativeString = "Just now";
  } else if (diffInSeconds < 3600) {
    const mins = Math.max(1, Math.floor(diffInSeconds / 60));
    relativeString = `${mins}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    relativeString = `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    relativeString = `${days}d ago`;
  }

  const dateString = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return { dateString, relativeString };
}

/**
 * Safely copies text to the clipboard and triggers visual confirmation.
 * 
 * @param {string} text - The text to copy
 * @param {HTMLElement} buttonElement - Button to show confirmation state
 */
async function copyToClipboard(text, buttonElement) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    if (buttonElement) {
      const originalHTML = buttonElement.innerHTML;
      buttonElement.classList.add("copied");
      buttonElement.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      setTimeout(() => {
        buttonElement.classList.remove("copied");
        buttonElement.innerHTML = originalHTML;
      }, 1500);
    }
  } catch (err) {
    console.error("Clipboard copy failed:", err);
  }
}

// ============================================================================
// 2. BACKEND API CLIENT
// ============================================================================

/**
 * Communicates with the Express backend service to retrieve on-chain wallet data.
 * 
 * @param {string} address - Valid Ethereum address
 * @returns {Promise<object>} - Aggregated wallet telemetry payload
 */
async function fetchWalletData(address) {
  const url = `${CONFIG.BACKEND_BASE_URL}/api/wallet/${encodeURIComponent(address)}`;
  
  let response;
  try {
    response = await fetch(url);
  } catch (netErr) {
    const connectionError = new Error("Unable to connect to backend server. Make sure the backend is running at http://localhost:3000.");
    connectionError.errorType = "DATA_RETRIEVAL_FAILED";
    throw connectionError;
  }

  const data = await response.json();

  if (!response.ok || !data.success) {
    const error = new Error(data.message || "Unable to retrieve wallet data.");
    error.errorType = data.errorType || "DATA_RETRIEVAL_FAILED";
    throw error;
  }

  return data;
}

// ============================================================================
// 3. UI STATE MANAGEMENT & DYNAMIC ERROR HEADINGS
// ============================================================================

/**
 * Maps errorType codes to dynamic, uppercase editorial error headings.
 * 
 * @param {string} errorType - Error code from backend or client
 * @returns {string} - Formatted heading string
 */
function getErrorHeading(errorType) {
  switch (errorType) {
    case "INVALID_ADDRESS":
      return "INVALID ADDRESS";
    case "API_RATE_LIMIT":
      return "API RATE LIMIT";
    case "DATA_RETRIEVAL_FAILED":
      return "DATA RETRIEVAL FAILED";
    case "SERVER_CONFIGURATION":
      return "SERVER CONFIGURATION";
    default:
      return "DATA RETRIEVAL FAILED";
  }
}

/**
 * Switches the UI between empty, loading, error, and result states.
 * 
 * @param {string} state - "empty" | "loading" | "error" | "results"
 * @param {string} message - Message body for loading/error
 * @param {string} heading - Dynamic heading for error banner
 */
function setViewState(state, message = "", heading = "DATA RETRIEVAL FAILED") {
  // Hide all dynamic sections first
  elements.emptyState.style.display = "none";
  elements.loadingState.classList.remove("active");
  elements.errorState.classList.remove("active");
  elements.resultsSection.classList.remove("active");
  elements.searchBtn.disabled = false;

  switch (state) {
    case "empty":
      elements.emptyState.style.display = "block";
      break;

    case "loading":
      elements.loadingState.classList.add("active");
      elements.loadingSubtext.textContent = message || "Querying Ethereum blockchain via backend service...";
      elements.searchBtn.disabled = true;
      break;

    case "error":
      elements.errorState.classList.add("active");
      elements.errorMessage.textContent = message || "An unexpected error occurred.";
      if (elements.errorHeading) {
        elements.errorHeading.textContent = heading;
      }
      break;

    case "results":
      elements.resultsSection.classList.add("active");
      break;
  }
}

/**
 * Renders the top statistics cards (Balance, Tx Count, Wallet Address).
 */
function renderStats(address, balanceWei, txCount) {
  // 1. ETH Balance
  const ethAmount = formatWeiToEth(balanceWei, 5);
  elements.ethBalanceValue.textContent = ethAmount;
  elements.ethBalanceWei.textContent = `${BigInt(balanceWei || 0).toLocaleString()} Wei`;

  // 2. Transaction Count (Nonce)
  elements.txCountValue.textContent = Number(txCount || 0).toLocaleString();

  // 3. Address Card
  elements.walletAddressDisplay.textContent = shortenAddress(address, 6);
  elements.walletAddressDisplay.title = address;
  elements.viewEtherscanLink.href = `${CONFIG.ETHERSCAN_EXPLORER_URL}/address/${address}`;

  // Attach copy address handler
  elements.copyAddressBtn.onclick = () => copyToClipboard(address, elements.copyAddressBtn);
}

/**
 * Renders the transaction list into both Desktop Editorial Table and Mobile Cards.
 */
function renderTransactions(transactions, queriedAddress) {
  const normalizedQueried = queriedAddress.toLowerCase();
  elements.txCountBadge.textContent = `${transactions.length} recent`;

  // Clear existing content
  elements.txTableBody.innerHTML = "";
  elements.txCardsMobile.innerHTML = "";

  if (!transactions || transactions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-dim); font-family: var(--font-mono); font-size: 0.8rem; letter-spacing: 0.1em;">
        NO RECENT TRANSACTIONS FOUND FOR THIS ADDRESS
      </td>
    `;
    elements.txTableBody.appendChild(emptyRow);

    const mobileEmpty = document.createElement("div");
    mobileEmpty.style.cssText = "text-align: center; padding: 32px; color: var(--text-dim); font-family: var(--font-mono); font-size: 0.8rem;";
    mobileEmpty.textContent = "NO RECENT TRANSACTIONS FOUND FOR THIS ADDRESS";
    elements.txCardsMobile.appendChild(mobileEmpty);
    return;
  }

  // Iterate transactions and render rows & mobile cards
  transactions.forEach((tx) => {
    const isOut = tx.from && tx.from.toLowerCase() === normalizedQueried;
    const directionBadge = isOut
      ? `<span class="badge-direction badge-out">OUT</span>`
      : `<span class="badge-direction badge-in">IN</span>`;

    const ethValue = formatWeiToEth(tx.value, 4);
    const { dateString, relativeString } = formatTimestamp(tx.timeStamp);
    const txUrl = `${CONFIG.ETHERSCAN_EXPLORER_URL}/tx/${tx.hash}`;
    const fromUrl = `${CONFIG.ETHERSCAN_EXPLORER_URL}/address/${tx.from}`;
    const toUrl = tx.to ? `${CONFIG.ETHERSCAN_EXPLORER_URL}/address/${tx.to}` : "#";

    // --- Desktop Table Row ---
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link" title="${tx.hash}">
          ${shortenAddress(tx.hash, 4)}
        </a>
      </td>
      <td>${directionBadge}</td>
      <td>
        <a href="${fromUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link" title="${tx.from}">
          ${shortenAddress(tx.from, 4)}
        </a>
      </td>
      <td>
        <a href="${toUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link" title="${tx.to || 'Contract Creation'}">
          ${tx.to ? shortenAddress(tx.to, 4) : 'Contract Creation'}
        </a>
      </td>
      <td>
        <span class="tx-amount ${isOut ? 'out' : 'in'}">
          ${isOut ? '-' : '+'}${ethValue} ETH
        </span>
      </td>
      <td>
        <div class="tx-date">
          <div>${dateString}</div>
          <small style="color: var(--text-dim); font-size: 0.72rem;">${relativeString}</small>
        </div>
      </td>
      <td style="text-align: right;">
        <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon-link">
          <span>View</span>
          <svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </td>
    `;
    elements.txTableBody.appendChild(row);

    // --- Mobile Card ---
    const mobileCard = document.createElement("div");
    mobileCard.className = "mobile-tx-card";
    mobileCard.innerHTML = `
      <div class="mobile-tx-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${directionBadge}
          <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link">
            ${shortenAddress(tx.hash, 4)}
          </a>
        </div>
        <span class="tx-amount ${isOut ? 'out' : 'in'}">
          ${isOut ? '-' : '+'}${ethValue} ETH
        </span>
      </div>

      <div class="mobile-tx-row">
        <span class="mobile-tx-label">From:</span>
        <a href="${fromUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link">
          ${shortenAddress(tx.from, 5)}
        </a>
      </div>

      <div class="mobile-tx-row">
        <span class="mobile-tx-label">To:</span>
        <a href="${toUrl}" target="_blank" rel="noopener noreferrer" class="tx-hash-link">
          ${tx.to ? shortenAddress(tx.to, 5) : 'Contract Creation'}
        </a>
      </div>

      <div class="mobile-tx-row" style="border-top: 1px solid var(--border-subtle); padding-top: 8px; margin-top: 2px;">
        <span style="font-size: 0.72rem; color: var(--text-dim);">${dateString} (${relativeString})</span>
        <a href="${txUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon-link" style="padding: 4px 8px; font-size: 0.7rem;">
          View on Etherscan &rarr;
        </a>
      </div>
    `;
    elements.txCardsMobile.appendChild(mobileCard);
  });
}

// ============================================================================
// 4. MAIN CONTROLLER
// ============================================================================

/**
 * Coordinates validating address, requesting data from backend, and rendering.
 * 
 * @param {string} rawAddress - User-supplied address
 */
async function analyzeWallet(rawAddress) {
  const address = rawAddress ? rawAddress.trim() : "";

  // 1. Client-Side Validation Check
  if (!address) {
    setViewState("error", "Please enter an Ethereum wallet address.", "INVALID ADDRESS");
    return;
  }

  if (!isValidEthereumAddress(address)) {
    setViewState(
      "error",
      "Invalid Ethereum wallet address format. An Ethereum address must start with '0x' followed by 40 hexadecimal characters (e.g. 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045).",
      "INVALID ADDRESS"
    );
    return;
  }

  // 2. Set Loading State
  setViewState("loading", "Querying Ethereum blockchain via backend service...");

  try {
    // 3. Single Call to Backend Service
    const data = await fetchWalletData(address);

    // 4. Render Returned Statistics and Transactions
    renderStats(data.address, data.balanceWei, data.transactionCount);
    renderTransactions(data.transactions, data.address);

    // 5. Reveal Results
    setViewState("results");

    // Scroll smoothly to results on mobile screens
    if (window.innerWidth < 768) {
      elements.resultsSection.scrollIntoView({ behavior: "smooth" });
    }
  } catch (error) {
    console.error("Wallet analysis error:", error);
    const heading = getErrorHeading(error.errorType);
    setViewState(
      "error",
      error.message || "Unable to retrieve wallet data. Please check your backend connection or try again.",
      heading
    );
  }
}

// ============================================================================
// 5. EVENT LISTENERS & INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Handle Form Submission
  elements.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    analyzeWallet(elements.addressInput.value);
  });

  // Handle Clear Button in Search Input
  elements.addressInput.addEventListener("input", () => {
    if (elements.addressInput.value.length > 0) {
      elements.clearBtn.classList.add("visible");
    } else {
      elements.clearBtn.classList.remove("visible");
    }
  });

  elements.clearBtn.addEventListener("click", () => {
    elements.addressInput.value = "";
    elements.clearBtn.classList.remove("visible");
    elements.addressInput.focus();
    setViewState("empty");
  });

  // Handle Quick Pick Curated Address Chips
  elements.quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const address = chip.getAttribute("data-address");
      if (address) {
        elements.addressInput.value = address;
        elements.clearBtn.classList.add("visible");
        analyzeWallet(address);
      }
    });
  });

  // Handle Dismiss Error Banner
  elements.errorCloseBtn.addEventListener("click", () => {
    elements.errorState.classList.remove("active");
  });
});

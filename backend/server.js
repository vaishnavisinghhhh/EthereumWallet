/**
 * ============================================================================
 * Ethereum Wallet Explorer — Backend Server
 * Express.js service providing secure on-chain ledger telemetry via Etherscan V2 API,
 * and serving the frontend static files.
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing
app.use(cors());
app.use(express.json());

// Absolute path to frontend directory
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Serve static assets from frontend directory (css, js, assets)
app.use(express.static(FRONTEND_DIR));

// Etherscan API V2 Base Configuration (Chain ID 1 = Ethereum Mainnet)
const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api';
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Ethereum Wallet Explorer backend is running.'
  });
});

/**
 * Wallet Data Aggregation Endpoint
 * GET /api/wallet/:address
 */
app.get('/api/wallet/:address', async (req, res) => {
  const { address } = req.params;

  // 1. Validate Ethereum Address Format
  if (!address || !ETH_ADDRESS_REGEX.test(address.trim())) {
    return res.status(400).json({
      success: false,
      errorType: 'INVALID_ADDRESS',
      message: 'Invalid Ethereum wallet address.'
    });
  }

  const cleanAddress = address.trim();

  // 2. Validate Etherscan API Key on Backend
  const apiKey = process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.trim() : '';

  if (!apiKey || apiKey === 'PASTE_YOUR_ETHERSCAN_API_KEY_HERE') {
    return res.status(500).json({
      success: false,
      errorType: 'SERVER_CONFIGURATION',
      message: 'Etherscan API key is not configured on the server. Please add your key to backend/.env.'
    });
  }

  try {
    // 3. Construct Etherscan V2 API URLs
    const balanceUrl = `${ETHERSCAN_V2_URL}?chainid=1&module=account&action=balance&address=${cleanAddress}&tag=latest&apikey=${apiKey}`;
    const txCountUrl = `${ETHERSCAN_V2_URL}?chainid=1&module=proxy&action=eth_getTransactionCount&address=${cleanAddress}&tag=latest&apikey=${apiKey}`;
    const txListUrl = `${ETHERSCAN_V2_URL}?chainid=1&module=account&action=txlist&address=${cleanAddress}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=${apiKey}`;

    // 4. Concurrently Query Etherscan V2 API
    const [balanceRes, txCountRes, txListRes] = await Promise.all([
      fetch(balanceUrl),
      fetch(txCountUrl),
      fetch(txListUrl)
    ]);

    // Check for HTTP 429 Rate Limiting across responses
    if (balanceRes.status === 429 || txCountRes.status === 429 || txListRes.status === 429) {
      return res.status(429).json({
        success: false,
        errorType: 'API_RATE_LIMIT',
        message: 'Etherscan API rate limit reached. Please try again later.'
      });
    }

    const [balanceData, txCountData, txListData] = await Promise.all([
      balanceRes.json(),
      txCountRes.json(),
      txListRes.json()
    ]);

    // Check Etherscan rate limit messages in JSON bodies
    const isRateLimited = 
      (balanceData.status === '0' && typeof balanceData.result === 'string' && balanceData.result.toLowerCase().includes('rate limit')) ||
      (txListData.status === '0' && typeof txListData.result === 'string' && txListData.result.toLowerCase().includes('rate limit')) ||
      (balanceData.message && balanceData.message.toLowerCase().includes('rate limit')) ||
      (txListData.message && txListData.message.toLowerCase().includes('rate limit'));

    if (isRateLimited) {
      return res.status(429).json({
        success: false,
        errorType: 'API_RATE_LIMIT',
        message: 'Etherscan API rate limit reached. Please try again later.'
      });
    }

    // Check if the API key is rejected by Etherscan
    const isInvalidApiKey = 
      (balanceData.status === '0' && typeof balanceData.result === 'string' && balanceData.result.toLowerCase().includes('api key')) ||
      (txListData.status === '0' && typeof txListData.result === 'string' && txListData.result.toLowerCase().includes('api key'));

    if (isInvalidApiKey) {
      return res.status(500).json({
        success: false,
        errorType: 'SERVER_CONFIGURATION',
        message: 'Invalid or unconfigured Etherscan API key. Please check backend/.env.'
      });
    }

    // Check for balance failure
    if (balanceData.status === '0' && balanceData.result !== '0') {
      return res.status(502).json({
        success: false,
        errorType: 'DATA_RETRIEVAL_FAILED',
        message: 'Unable to retrieve wallet balance.'
      });
    }

    // 5. Parse Data
    const balanceWei = balanceData.result || '0';

    // Parse Outgoing Transaction Count (Nonce) from Proxy
    let transactionCount = 0;
    if (txCountData && txCountData.result) {
      transactionCount = parseInt(txCountData.result, 16) || 0;
    }

    // Parse Recent Transactions List
    let transactions = [];
    if (txListData.status === '1' && Array.isArray(txListData.result)) {
      transactions = txListData.result;
    } else if (txListData.message === 'No transactions found') {
      transactions = [];
    }

    // 6. Return Aggregated Response
    return res.status(200).json({
      success: true,
      address: cleanAddress,
      balanceWei: balanceWei.toString(),
      transactionCount: transactionCount,
      transactions: transactions
    });

  } catch (err) {
    console.error('Backend wallet query error:', err);
    return res.status(502).json({
      success: false,
      errorType: 'DATA_RETRIEVAL_FAILED',
      message: 'Unable to retrieve wallet data.'
    });
  }
});

// Fallback: Serve frontend/index.html on root and all non-API GET requests
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[ETHEREUM EXPLORER BACKEND] Server running at http://localhost:${PORT}`);
  console.log(`[ETHEREUM EXPLORER BACKEND] Frontend accessible at http://localhost:${PORT}/`);
  console.log(`[ETHEREUM EXPLORER BACKEND] Health check available at http://localhost:${PORT}/api/health`);
});

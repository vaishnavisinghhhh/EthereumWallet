# 💎 Ethereum Wallet Explorer

A full-stack, beginner-friendly **Ethereum Wallet Explorer** featuring a decoupled **Vanilla HTML/CSS/JavaScript Frontend** (luxury dark editorial aesthetic) and a **Node.js + Express Backend** that securely queries the **Etherscan V2 API**.

---

## 🏗️ Architecture Overview

In production Web3 and web applications, API keys and secrets should **never** be exposed in client-side browser code. This project demonstrates clean separation of concerns:

```text
┌─────────────────────────────────┐
│     Client Browser (Frontend)   │
│  - Vanilla HTML, CSS, JavaScript│
│  - Luxury Dark Editorial UI     │
│  - Local Address Validation     │
└───────────────┬─────────────────┘
                │
                │ GET http://localhost:3000/api/wallet/:address
                ▼
┌─────────────────────────────────┐
│     Express Service (Backend)   │
│  - Node.js + Express + CORS     │
│  - Reads key from backend/.env  │
│  - Validates Ethereum address   │
│  - Aggregates on-chain data     │
│  - Graceful rate-limit handling │
└───────────────┬─────────────────┘
                │
                │ HTTPS (Etherscan V2 API with API Key)
                ▼
┌─────────────────────────────────┐
│      Etherscan V2 API / Chain 1 │
│  - Account Balance (Wei)        │
│  - Outgoing Nonce (Tx Count)    │
│  - Recent Transactions List     │
└─────────────────────────────────┘
```

### 🔒 Why API Keys Belong on the Backend
1. **Security**: Any variable in frontend JavaScript can be inspected by opening browser DevTools (Network tab, Sources).
2. **Abuse Prevention**: If a private Etherscan API key is shipped in frontend JavaScript, anyone can extract and exhaust your free rate limit quota.
3. **Decoupling**: The frontend simply asks for wallet telemetry; the backend abstracts away blockchain provider rate-limits, format conversions, and API version upgrades.

---

## 📁 Project Structure

```text
Ethereum wallet/
│
├── frontend/
│   ├── index.html            # Editorial layout (all styling & animations preserved)
│   ├── css/
│   │   └── style.css         # Luxury dark Web3 aesthetic (A24 / editorial terminal)
│   ├── js/
│   │   └── script.js         # Frontend controller calling localhost:3000
│   └── assets/
│       └── favicon.svg       # Custom champagne/silver Ethereum diamond
│
├── backend/
│   ├── server.js             # Express API (Etherscan V2 aggregation & rate limiting)
│   ├── package.json          # Dependencies (express, cors, dotenv)
│   ├── .env                  # Environment variables (IGNORED BY GIT)
│   └── .gitignore            # Ignores node_modules/ and .env
│
└── README.md                 # Complete documentation & setup guide
```

---

## 🚀 Getting Started

Follow these simple steps to run both the backend server and the frontend interface:

### 1. Configure the Backend

1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Open `backend/.env` in your code editor. It contains:
   ```env
   ETHERSCAN_API_KEY=PASTE_YOUR_ETHERSCAN_API_KEY_HERE
   PORT=3000
   ```
4. Replace `PASTE_YOUR_ETHERSCAN_API_KEY_HERE` with your free Etherscan API key (obtainable in 1 minute from [etherscan.io/apis](https://etherscan.io/apis)).
   *(Never commit `.env` to git; it is automatically ignored by `backend/.gitignore`).*

### 2. Start the Backend Server

Inside the `backend/` directory, run:
```bash
npm run dev
# or: npm start
```

You should see:
```text
[ETHEREUM EXPLORER BACKEND] Server running at http://localhost:3000
[ETHEREUM EXPLORER BACKEND] Health check available at http://localhost:3000/api/health
```

You can verify the backend is running by opening `http://localhost:3000/api/health` in your browser. It will respond:
```json
{
  "success": true,
  "message": "Ethereum Wallet Explorer backend is running."
}
```

### 3. Open the Frontend

1. Navigate to the `frontend/` folder.
2. Double-click `index.html` to open it in any web browser (Chrome, Edge, Firefox, Safari), or open it with the VS Code **Live Server** extension.
3. Click any curated address (e.g., `vitalik.eth`) or enter an Ethereum address (`0x...`) and click **ANALYZE WALLET &rarr;**.

---

## 📡 Backend API Endpoints

### 1. `GET /api/health`
Health check endpoint to verify backend service status.
* **Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "message": "Ethereum Wallet Explorer backend is running."
  }
  ```

### 2. `GET /api/wallet/:address`
Aggregates live balance, nonce, and recent transactions from Etherscan V2.
* **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "balanceWei": "5715987139328012679",
    "transactionCount": 5966,
    "transactions": [
      {
        "hash": "0x...",
        "from": "0x...",
        "to": "0x...",
        "value": "10000000000000000",
        "timeStamp": "1727787000"
      }
    ]
  }
  ```
* **Error Responses**:
  * Invalid Address (HTTP 400):
    ```json
    { "success": false, "errorType": "INVALID_ADDRESS", "message": "Invalid Ethereum wallet address." }
    ```
  * Unconfigured Key (HTTP 500):
    ```json
    { "success": false, "errorType": "SERVER_CONFIGURATION", "message": "Etherscan API key is not configured on the server. Please add your key to backend/.env." }
    ```
  * Rate Limited (HTTP 429):
    ```json
    { "success": false, "errorType": "API_RATE_LIMIT", "message": "Etherscan API rate limit reached. Please try again later." }
    ```

---

## 🧠 Core Blockchain Concepts Explained

### 1. What is an Ethereum Address?
A 42-character string starting with `0x` followed by 40 hexadecimal characters (`0-9`, `a-f`). It represents a public destination on the decentralized Ethereum state machine.

### 2. Public Address vs. Private Key
* **Public Address**: Publicly known destination where anyone can view on-chain balances and send funds.
* **Private Key / Seed Phrase**: The cryptographic secret that authorizes transactions. **Never enter or share a private key.**

### 3. What is Wei?
Ethereum calculations are processed in integers to avoid floating-point rounding errors.
* $1 \text{ ETH} = 10^{18} \text{ Wei} = 1,000,000,000,000,000,000 \text{ Wei}$.
* The frontend uses native JavaScript `BigInt` to format balances with mathematical precision.

### 4. What is a Nonce (Transaction Count)?
The sequential number of transactions sent from an Ethereum account. A wallet's current nonce equals its **total outgoing transaction count**.

---

## 📜 License
Open-source and free to use for educational and portfolio demonstration.

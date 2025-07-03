# EffiSend

EffiSend: Next-generation crosschain payment wallet with FaceID, QR payments, smart USD balance management, and programmable multi-chain transactions—powered by MetaMask SDK, Circle Developer Controlled Wallets, and LiFi.

<img src="./Images/featuredEffiSend.png">

---

## Fast Links:

URL: [CODE](./EffiSend/)

PLAYSTORE LINK: *Coming soon*

VIDEODEMO: *Coming soon*

---

# System Diagram

## Circle & LiFi Integration:

<img src="./Images/effisend_architecture.png">

- **MetaMask SDK**: Secure, non-custodial wallet integration for native user onboarding and signatures.  
- **Circle Developer Controlled Wallets**: Custodial programmable wallets secured without mnemonics, tied to DID/FaceID.  
- **LiFi Crosschain Router**: For seamless cross-chain bridging and token swaps, fully abstracted from end-user.

---

# 🚀 Features

## 💳 Multi-chain Programmable Wallet

EffiSend leverages **Circle Developer Controlled Wallets** for secure, non-custodial custody:

- Each wallet tied to a FaceID/DID.
- All assets secured on Circle; no user-managed private keys.
- Transactions signed and executed via backend Circle SDK.

```javascript
const transaction = {
    amount,
    destinationAddress,
    walletId,
    blockchain: blockchains[req.body.chain],
};
await circleDeveloperSdk.createTransaction({
    ...transaction,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
});
```

---

## 🔗 Cross-chain LiFi Payments

EffiSend integrates **LiFi** via backend APIs for truly seamless cross-chain payments.

- Select token & amount in USD.
- LiFi handles routing, bridging, and swaps under the hood.
- User sees only USD amounts and transaction confirmation.

Transaction flow managed through:
```javascript
const quote = await getQuote(quoteRequest);
const route = convertQuoteToRoute(quote);
```

---

## 🔥 FaceID Biometric Verification

<img src="./Images/faceid.png">

- Register or pay via FaceID with `expo-camera` and secure uploads.
- Wallet creation & payment approvals tied to biometrics, removing passwords.

---

## 📷 QR Code Payments

<img src="./Images/qr_pay.png">

- Generate QR codes to receive payments.
- Scan peer or merchant QR codes to instantly pay.

Built with `react-native-qrcode-svg` & `CamQR` component.

---

## 💰 USD Portfolio & Multi-Token Manager

<img src="./Images/balance_tab.png">

- Displays balances across chains & tokens.
- Uses Coingecko API for live USD rates.
- Batch smart contracts fetch balances in a single call.

---

## 🥇 Trust Score & Rewards

<img src="./Images/profile_rewards.png">

- Verify with FaceID to unlock EFS rewards.
- Grow your trust score for better fees and premium features.

---

# 🛠️ Main Technical Implementations

| Component / Screen      | Description                                  |
|--------------------------|---------------------------------------------|
| `metamaskProvider.js`    | MetaMask SDK, chain & account context.      |
| `tab1.js`                | Balances, FaceID register, add funds, QR.   |
| `tab2.js`                | Payments: scan QR / FaceID, pay via LiFi.   |
| `tab3.js`                | Profile, trust score, rewards claim.        |
| `receipt.js`             | Printable receipt + transaction QR.         |
| `header.js`              | Wallet connect / disconnect buttons.        |
| `camFace.js`, `camQR.js` | Secure camera components.                   |

---

# 🔥 LiFi + Circle Developer Controlled Wallets (Backend)

EffiSend uses a **Google Cloud Function (Node.js)** to securely execute payments using Circle Developer Controlled Wallets.  
For cross-chain payments it integrates **LiFi SDK**, executing bridging & swaps with full custody on Circle.

---

## 🚀 Example Backend Flow

### 1. Check if user exists
```javascript
const query = await db.collection("DID").where("user", "==", decrypted).get();
```

---

### 2. Same-chain payment
#### - Native transfer
```javascript
await circleDeveloperSdk.createTransaction({
    amount: [amount],
    destinationAddress,
    walletId: wallet.id,
    blockchain: blockchains[chainIndex],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
});
```
#### - ERC20 transfer
```javascript
const interface = new ethers.utils.Interface(abiERC20);
const transaction = interface.encodeFunctionData("transferFrom", [
    address,
    destinationAddress,
    ethers.utils.parseUnits(amount, tokenDecimals)
]);
await circleDeveloperSdk.createContractExecutionTransaction({
    walletId: wallet.id,
    callData: transaction,
    contractAddress: token,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
});
```

---

### 3. Cross-chain payment with LiFi
#### a) Transfer tokens to wallet
```javascript
const transactionXY = interface.encodeFunctionData("transferFrom", [
    address, wallet.address,
    ethers.utils.parseUnits(amount, decimals)
]);
await circleDeveloperSdk.createContractExecutionTransaction(...);
```

#### b) Approve LiFi contract
```javascript
const quote = await getQuote(quoteRequest);
const transactionApproval = interface.encodeFunctionData("approve", [
    transaction.to, quoteRequest.fromAmount
]);
await circleDeveloperSdk.createContractExecutionTransaction(...);
```

#### c) Execute LiFi bridge + swap
```javascript
await circleDeveloperSdk.createContractExecutionTransaction({
    walletId: wallet.id,
    amount: ethers.utils.formatEther(transaction.value),
    callData: transaction.data,
    contractAddress: transaction.to,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } }
});
```

---

### ✅ Highlights
- Full custody by **Circle Developer Controlled Wallets** (no private keys exposed).
- Cross-chain routes by **LiFi SDK**.
- User only sees simple USD payment confirmation.

---

# 📝 Deployment Notes

- Hosted as **Google Cloud Functions** (serverless).
- User wallets indexed in **Firestore** by DID.
- Sensitive user assets never leave Circle’s programmable wallets.

---

# 🔗 References

1. [MetaMask SDK](https://github.com/MetaMask/sdk)
2. [Circle Developer Controlled Wallets](https://developers.circle.com)
3. [LiFi Crosschain Routing](https://www.lifi.io)
4. [Coingecko API](https://www.coingecko.com/en/api)

---

✅ **Ready for production:**  
EffiSend turns complex multi-chain payments into a simple FaceID scan or QR tap — while MetaMask, Circle and LiFi handle the complexity under the hood.

---

# 📸 UI Screenshots

| Home / Balances | Payments | Profile / Rewards |
|-----------------|----------|-------------------|
| <img src="./Images/ui_home.png" width="32%"> | <img src="./Images/ui_payment.png" width="32%"> | <img src="./Images/ui_profile.png" width="32%"> |

---

**Built with ❤️ using MetaMask SDK, Circle Programmable Wallets, and LiFi.**

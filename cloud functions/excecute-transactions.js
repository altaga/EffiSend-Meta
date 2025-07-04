const functions = require("@google-cloud/functions-framework");
const {
    initiateDeveloperControlledWalletsClient,
} = require("@circle-fin/developer-controlled-wallets");
const { apiKey, entitySecret } = require("./secrets");
const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
});
const Firestore = require("@google-cloud/firestore");
const {
    abi: abiERC20,
} = require("@openzeppelin/contracts/build/contracts/ERC20.json");
const ethers = require("ethers");
const { convertQuoteToRoute, getQuote } = require("@lifi/sdk");

const db = new Firestore({
    projectId: "xxxxxxxxxxxxx",
    keyFilename: "credential.json",
});

functions.http("helloHttp", async (req, res) => {
    try {
        // Checks
        const decrypted = req.body.user;
        let collection;
        let query;
        if (decrypted.indexOf("did_") >= 0) {
            collection = db.collection("DID");
            query = await collection.where("user", "==", decrypted).get();
        } else {
            throw "Bad User";
        }
        if (query.empty) {
            throw "Query Empty";
        } else {
            let txHash = "";
            // Parameters
            const token = req.body.token;
            const amount = req.body.amount;
            const destinationAddress = req.body.destinationAddress;
            // Wallet ID
            const address = query.docs[0].data().address;
            const wallet = query.docs[0].data().wallets[req.body.chainFrom];
            // Detect onChain or crossChain
            if (req.body.chainFrom === req.body.chainTo) {
                const chainIndex = chains.findIndex((e) => e === req.body.chainFrom);
                const tokenIndex = tokens[chainIndex].findIndex(
                    (e) => e.address === token
                );
                if (token === "0x0000000000000000000000000000000000000000") {
                    const transaction = {
                        amount: [amount],
                        destinationAddress,
                        walletId: wallet.id,
                        blockchain: blockchains[chainIndex],
                    };
                    let response = await circleDeveloperSdk.createTransaction({
                        ...transaction,
                        fee: {
                            type: "level",
                            config: {
                                feeLevel: "MEDIUM",
                            },
                        },
                    });
                    const { id } = response.data;
                    txHash = await new Promise((resolve) => {
                        const interval = setInterval(async () => {
                            response = await circleDeveloperSdk.getTransaction({
                                id,
                            });
                            if (response.data.transaction?.txHash) {
                                clearInterval(interval);
                                resolve(response.data.transaction.txHash);
                            }
                        }, 1000);
                    });
                } else {
                    const interface = new ethers.utils.Interface(abiERC20);
                    const transaction = interface.encodeFunctionData("transferFrom", [
                        address,
                        destinationAddress,
                        ethers.utils.parseUnits(
                            amount,
                            tokens[chainIndex][tokenIndex].decimals
                        ),
                    ]);
                    let response =
                        await circleDeveloperSdk.createContractExecutionTransaction({
                            walletId: wallet.id,
                            callData: transaction,
                            contractAddress: token,
                            fee: {
                                type: "level",
                                config: {
                                    feeLevel: "MEDIUM",
                                },
                            },
                        });
                    const { id } = response.data;
                    txHash = await new Promise((resolve) => {
                        const interval = setInterval(async () => {
                            response = await circleDeveloperSdk.getTransaction({
                                id,
                            });
                            if (response.data.transaction?.txHash) {
                                clearInterval(interval);
                                resolve(response.data.transaction.txHash);
                            }
                        }, 1000);
                    });
                }
            } else {
                const chainFromIndex = chains.findIndex(
                    (e) => e === req.body.chainFrom
                );
                const chainToIndex = chains.findIndex((e) => e === req.body.chainTo);
                const tokenIndex = tokens[chainFromIndex].findIndex(
                    (e) => e.address === token
                );
                console.log(chainToIndex)
                console.log(tokenIndex)
                // Transfer tokens from X to Y
                const interface = new ethers.utils.Interface(abiERC20);
                const transactionXY = interface.encodeFunctionData("transferFrom", [
                    address,
                    wallet.address,
                    ethers.utils.parseUnits(
                        amount,
                        tokens[chainFromIndex][tokenIndex].decimals
                    ),
                ]);
                let response =
                    await circleDeveloperSdk.createContractExecutionTransaction({
                        walletId: wallet.id,
                        callData: transactionXY,
                        contractAddress: token,
                        fee: {
                            type: "level",
                            config: {
                                feeLevel: "MEDIUM",
                            },
                        },
                    });
                const { id: idXY } = response.data;
                txHash = await new Promise((resolve) => {
                    const interval = setInterval(async () => {
                        response = await circleDeveloperSdk.getTransaction({
                            id: idXY,
                        });
                        if (response.data.transaction.state === "CONFIRMED") {
                            console.log("CONF")
                            clearInterval(interval);
                            resolve(response.data.transaction.txHash);
                        }
                    }, 1000);
                });
                console.log(txHash);
                // Approve LiFi to transfer tokens
                const quoteRequest = {
                    fromChain: chainsId[chainFromIndex], // Base
                    toChain: chainsId[chainToIndex], // Arbitrum
                    fromToken: tokens[chainFromIndex][tokenIndex].address, // USDC on Base
                    toToken: tokens[chainToIndex][tokenIndex].address, // USDC on Arbitrum
                    fromAmount: ethers.utils.parseUnits(
                        amount,
                        tokens[chainFromIndex][tokenIndex].decimals
                    ),
                    fromAddress: wallet.address,
                    toAddress: destinationAddress,
                    allowBridges: ["mayanMCTP", "celercircle", "stargateV2", "stargateV2Bus"],
                };
                const quote = await getQuote(quoteRequest);
                const route = convertQuoteToRoute(quote);
                const transaction = route.steps[0].transactionRequest;
                const transactionApproval = await interface.encodeFunctionData(
                    "approve",
                    [transaction.to, quoteRequest.fromAmount]
                );
                response = await circleDeveloperSdk.createContractExecutionTransaction({
                    walletId: wallet.id,
                    callData: transactionApproval,
                    contractAddress: token,
                    fee: {
                        type: "level",
                        config: {
                            feeLevel: "MEDIUM",
                        },
                    },
                });
                const { id: idApproval } = response.data;
                txHash = await new Promise((resolve) => {
                    const interval = setInterval(async () => {
                        response = await circleDeveloperSdk.getTransaction({
                            id: idApproval,
                        });
                        if (response.data.transaction.state === "CONFIRMED") {
                            console.log("CONF")
                            clearInterval(interval);
                            resolve(response.data.transaction.txHash);
                        }
                    }, 1000);
                });
                console.log(txHash);
                console.log({
                    walletId: wallet.id,
                    amount: ethers.utils.formatEther(transaction.value),
                    callData: transaction.data,
                    contractAddress: transaction.to,
                    fee: {
                        type: "level",
                        config: {
                            feeLevel: "MEDIUM",
                        },
                    },
                })
                // Excute LiFi transaction
                response = await circleDeveloperSdk.createContractExecutionTransaction({
                    walletId: wallet.id,
                    amount: ethers.utils.formatEther(transaction.value),
                    callData: transaction.data,
                    contractAddress: transaction.to,
                    fee: {
                        type: "level",
                        config: {
                            feeLevel: "MEDIUM",
                        },
                    },
                });
                const { id: idLiFi } = response.data;
                txHash = await new Promise((resolve) => {
                    const interval = setInterval(async () => {
                        response = await circleDeveloperSdk.getTransaction({
                            id: idLiFi,
                        });
                        if (response.data.transaction?.txHash) {
                            clearInterval(interval);
                            resolve(response.data.transaction.txHash);
                        }
                    }, 1000);
                });
                console.log(txHash);
            }
            res.send({
                error: null,
                result: txHash,
            });
        }
    } catch (e) {
        console.log(e);
        res.send({
            e: "Bad Request",
            result: null,
        });
    }
});

const chains = ["base", "eth", "arb", "avax", "op", "pol"];
const blockchains = ["BASE", "ETH", "ARB", "AVAX", "OP", "MATIC"];
const chainsId = [8453, 1, 42161, 43114, 10, 137];
const tokens = [
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
        { address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", decimals: 6 },
        { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ],
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
        { address: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c", decimals: 6 },
        { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
        { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
    ],
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
        { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
        { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    ],
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
        { address: "0xc891eb4cbdeff6e073e859e987815ed1505c2acd", decimals: 6 },
        { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
        { address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", decimals: 18 },
    ],
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
        { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
        { address: "0x4200000000000000000000000000000000000006", decimals: 18 },
    ],
    [
        { address: "0x0000000000000000000000000000000000000000", decimals: 18 },
        { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
        { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
        { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
    ],
];

const rpcs = [
    [
        "https://base-rpc.publicnode.com",
        "https://base.llamarpc.com",
        "https://base.drpc.org",
    ],
    [
        "https://ethereum-rpc.publicnode.com",
        "https://eth.llamarpc.com",
        "https://eth-pokt.nodies.app",
        "https://eth.drpc.org",
    ],
    [
        "https://arbitrum-one-rpc.publicnode.com",
        "https://arb-pokt.nodies.app",
        "https://arbitrum.drpc.org",
    ],
    [
        "https://avalanche.drpc.org",
        "https://avax-pokt.nodies.app/",
        "https://avalanche.drpc.org",
    ],
    [
        "https://optimism-rpc.publicnode.com",
        "https://op-pokt.nodies.app",
        "https://optimism.drpc.org",
    ],
    [
        "https://polygon-bor-rpc.publicnode.com",
        "https://polygon-pokt.nodies.app",
        "https://polygon.drpc.org",
    ],
];
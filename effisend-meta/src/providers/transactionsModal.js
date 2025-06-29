import { ethers } from "ethers";
import React, { Component, Fragment } from "react";
import {
  Dimensions,
  Image,
  Linking,
  Modal,
  NativeEventEmitter,
  Pressable,
  Text,
  View,
} from "react-native";
import checkMark from "../assets/images/checkMark.png";
import { abiERC20 } from "../contracts/erc20";
import { abiCircleRelayer } from "../contracts/ICircleRelayer";
import { abiMultiChainChat } from "../contracts/multiChainChat";
import { blockchains } from "../core/constants";
import GlobalStyles, {
  backgroundColor,
  mainColor,
  secondaryColor,
  textColor,
} from "../core/styles";
import { useHOCS } from "../hocs/useHOCS";
import {
  addressToBytes32,
  epsilonRound,
  setupProvider,
  verifyWallet,
} from "../core/utils";
import ContextModule from "./contextModule";

const baseTransactionsModalState = {
  stage: 0, // 0
  loading: true,
  explorerURL: "",
  gas: "0.0",
};

class TransactionsModal extends Component {
  constructor(props) {
    super(props);
    this.state = baseTransactionsModalState;
    this.provider = blockchains.map((x) => setupProvider(x.rpc));
    this.usdcContract = blockchains.map(
      (x, i) => new ethers.Contract(x.USDC, abiERC20, this.provider[i])
    );
    this.circleRelayerContract = blockchains.map(
      (x, i) =>
        new ethers.Contract(x.circleRelayer, abiCircleRelayer, this.provider[i])
    );
    this.controller = new AbortController();
    this.EventEmitter = new NativeEventEmitter();
  }

  static contextType = ContextModule;

  async setStateAsync(value) {
    return new Promise((resolve) => {
      this.setState(
        {
          ...value,
        },
        () => resolve()
      );
    });
  }

  async checkTransaction() {
    // Crosschain flag
    const crossChainFlag =
      this.context.value.fromChain !== this.context.value.toChain;
    // Gas Estimate
    let gasT1 = await this.provider[
      this.context.value.transactionData.chainSelected
    ].estimateGas(this.context.value.transactionData.transaction);
    let gasT2 = ethers.BigNumber.from(0);
    if (
      this.context.value.transactionData.command === "sendMessage" &&
      parseFloat(this.context.value.transactionData.amount) > 0 &&
      !crossChainFlag
    ) {
      let t2 = await this.usdcContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.transfer(
        this.context.value.transactionData.to,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6)
      );
      t2 = {
        ...t2,
        value: "0x0",
        from: this.context.value.address,
      };
      gasT2 = await this.provider[
        this.context.value.transactionData.chainSelected
      ].estimateGas(t2);
    } else if (
      this.context.value.transactionData.command === "sendMessage" &&
      parseFloat(this.context.value.transactionData.amount) > 0 &&
      crossChainFlag
    ) {
      const circleRelayerAddress =
        this.circleRelayerContract[
          this.context.value.transactionData.chainSelected
        ].address;
      // Get gas estimate for approval
      let t2 = await this.usdcContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.approve(
        circleRelayerAddress,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6)
      );
      t2 = {
        ...t2,
        value: "0x0",
        from: this.context.value.address,
      };
      const gasT2_1 = await this.provider[
        this.context.value.transactionData.chainSelected
      ].estimateGas(t2);
      // Get gas estimate for transfer
      t2 = await this.usdcContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.transfer(
        circleRelayerAddress,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6)
      );
      t2 = {
        ...t2,
        value: "0x0",
        from: this.context.value.address,
      };
      const gasT2_2 = await this.provider[
        this.context.value.transactionData.chainSelected
      ].estimateGas(t2);
      gasT2 = gasT2_1.add(gasT2_2);
    }
    const gasPrice = await this.provider[
      this.context.value.transactionData.chainSelected
    ].getGasPrice();
    const gasTotal = gasT1.add(gasT2);
    const value =
      this.context.value.transactionData.transaction.value ??
      ethers.BigNumber.from(0);
    await this.setStateAsync({
      loading: false,
      gas: ethers.utils.formatEther(
        gasTotal.mul(gasPrice).mul(250).div(100).add(value)
      ),
    });
  }

  async processTransaction() {
    const crossChainFlag =
      this.context.value.fromChain !== this.context.value.toChain;
    const provider = await this.props.wallet.getProvider();
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: `0x${blockchains[
            this.context.value.transactionData.chainSelected
          ].chainId.toString(16)}`,
        },
      ],
    });
    let result;
    if (
      this.context.value.transactionData.command === "sendMessage" &&
      parseFloat(this.context.value.transactionData.amount) > 0 &&
      !crossChainFlag
    ) {
      let tokenTransfer = await this.usdcContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.transfer(
        this.context.value.transactionData.to,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6)
      );
      tokenTransfer = {
        ...tokenTransfer,
        value: "0x0",
        from: this.context.value.address,
      };
      result = await provider.request({
        method: "eth_sendTransaction",
        params: [tokenTransfer],
      });
      await this.provider[
        this.context.value.transactionData.chainSelected
      ].waitForTransaction(result);
    } else if (
      this.context.value.transactionData.command === "sendMessage" &&
      parseFloat(this.context.value.transactionData.amount) > 0 &&
      crossChainFlag
    ) {
      const circleRelayerAddress =
        this.circleRelayerContract[
          this.context.value.transactionData.chainSelected
        ].address;
      // Get gas estimate for approval
      let allowance = await this.usdcContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.approve(
        circleRelayerAddress,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6)
      );
      allowance = {
        ...allowance,
        value: "0x0",
        from: this.context.value.address,
      };
      result = await provider.request({
        method: "eth_sendTransaction",
        params: [allowance],
      });
      await this.provider[
        this.context.value.transactionData.chainSelected
      ].waitForTransaction(result);
      let tokenTransfer = await this.circleRelayerContract[
        this.context.value.transactionData.chainSelected
      ].populateTransaction.transferTokensWithRelay(
        this.usdcContract[this.context.value.transactionData.chainSelected]
          .address,
        ethers.utils.parseUnits(this.context.value.transactionData.amount, 6),
        ethers.BigNumber.from(0),
        this.context.value.toChain,
        addressToBytes32(this.context.value.transactionData.to)
      );
      tokenTransfer = {
        ...tokenTransfer,
        value: "0x0",
        from: this.context.value.address,
      };
      result = await provider.request({
        method: "eth_sendTransaction",
        params: [tokenTransfer],
      });
      await this.provider[
        this.context.value.transactionData.chainSelected
      ].waitForTransaction(result);
    }
    const { transaction } = this.context.value.transactionData;
    result = await provider.request({
      method: "eth_sendTransaction",
      params: [transaction],
    });
    await this.provider[
      this.context.value.transactionData.chainSelected
    ].waitForTransaction(result);
    if (this.context.value.transactionData.command === "sendMessage") {
      await this.setStateAsync({
        loading: false,
        explorerURL:
          this.context.value.fromChain !== this.context.value.toChain
            ? `https://wormholescan.io/#/tx/${result}`
            : `${
                blockchains[this.context.value.transactionData.chainSelected]
                  .blockExplorer
              }tx/${result}`,
      });
    } else {
      await this.setStateAsync({
        loading: false,
        explorerURL: `${
          blockchains[this.context.value.transactionData.chainSelected]
            .blockExplorer
        }tx/${result}`,
      });
    }
  }

  // Utils

  async setStateAsync(value) {
    return new Promise((resolve) => {
      this.setState(
        {
          ...value,
        },
        () => resolve()
      );
    });
  }

  render() {
    return (
      <Modal
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
        }}
        visible={this.context.value.isTransactionActive}
        transparent={true}
        onShow={async () => {
          await this.setStateAsync(baseTransactionsModalState);
          await this.checkTransaction();
        }}
        animationType="fade"
      >
        <View
          style={{
            height: Dimensions.get("window").height,
            width: Dimensions.get("window").width,
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              height: "98%",
              width: "98%",
              justifyContent: "space-between",
              alignItems: "center",
              borderWidth: 2,
              borderRadius: 25,
              borderColor: mainColor,
              backgroundColor: backgroundColor,
              paddingVertical: 10,
            }}
          >
            {this.state.stage === 0 && (
              <React.Fragment>
                <View style={{ width: "100%", gap: 20, alignItems: "center" }}>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 18,
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    Transaction:
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 22,
                      width: "100%",
                      marginBottom: 10,
                    }}
                  >
                    {this.context.value.transactionData.label}
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 18,
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    To Address:
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: verifyWallet(
                        this.context.value.transactionData.to
                      )
                        ? 18
                        : 22,
                      width: "100%",
                      marginBottom: 10,
                    }}
                  >
                    {this.context.value.transactionData.to.substring(0, 21) +
                      "\n" +
                      this.context.value.transactionData.to.substring(21)}
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 18,
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    Amount (or Equivalent):
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 20,
                      width: "100%",
                      marginBottom: 10,
                    }}
                  >
                    {epsilonRound(this.context.value.transactionData.amount, 8)}{" "}
                    {this.context.value.transactionData.tokenSymbol}
                    {"\n ( $"}
                    {epsilonRound(
                      this.context.value.transactionData.amount *
                        this.context.value.usdConversion[
                          this.context.value.transactionData.chainSelected
                        ][this.context.value.transactionData.tokenSelected],
                      6
                    )}
                    {" USD )"}
                  </Text>

                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 18,
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    Gas:
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: 20,
                      width: "100%",
                      marginBottom: 10,
                    }}
                  >
                    {this.state.loading ? (
                      "Calculating..."
                    ) : (
                      <Fragment>
                        {epsilonRound(this.state.gas, 8)}{" "}
                        {
                          blockchains[
                            this.context.value.transactionData.chainSelected
                          ].token
                        }
                        {"\n ( $"}
                        {epsilonRound(
                          this.state.gas *
                            this.context.value.usdConversion[
                              this.context.value.transactionData.chainSelected
                            ][
                              this.context.value.transactionData.command ===
                              "sendMessage"
                                ? 0
                                : this.context.value.transactionData
                                    .tokenSelected
                            ],
                          6
                        )}
                        {" USD )"}
                      </Fragment>
                    )}
                  </Text>
                </View>
                <View style={{ gap: 10, width: "100%", alignItems: "center" }}>
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyle,
                      this.state.loading ? { opacity: 0.5 } : {},
                    ]}
                    onPress={() => {
                      this.setState({
                        loading: true,
                        stage: 1,
                      });
                      this.processTransaction();
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 24,
                        fontWeight: "bold",
                      }}
                    >
                      Execute
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[GlobalStyles.buttonCancelStyle]}
                    onPress={async () => {
                      this.context.setValue({
                        isTransactionActive: false,
                      });
                    }}
                  >
                    <Text style={GlobalStyles.buttonCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </React.Fragment>
            )}
            {this.state.stage === 1 && (
              <React.Fragment>
                <Image
                  source={checkMark}
                  alt="check"
                  style={{ width: 200, height: 200 }}
                />
                <Text
                  style={{
                    marginTop: "20%",
                    textShadowRadius: 1,
                    fontSize: 28,
                    fontWeight: "bold",
                    color: this.state.loading ? mainColor : secondaryColor,
                  }}
                >
                  {this.state.loading ? "Processing..." : "Completed"}
                </Text>
                <View style={{ gap: 10, width: "100%", alignItems: "center" }}>
                  <View style={[GlobalStyles.network]}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <View style={{ marginHorizontal: 20 }}>
                        <Text style={{ fontSize: 20, color: textColor }}>
                          Transaction
                        </Text>
                        <Text style={{ fontSize: 14, color: textColor }}>
                          {this.context.value.transactionData.label}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        marginHorizontal: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View style={{ marginHorizontal: 10 }}>
                        {
                          blockchains[
                            this.context.value.transactionData.chainSelected
                          ].tokens[
                            this.context.value.transactionData.tokenSelected
                          ].icon
                        }
                      </View>
                      <Text style={{ color: textColor }}>
                        {`${epsilonRound(
                          this.context.value.transactionData.amount,
                          8
                        )}`}{" "}
                        {
                          blockchains[
                            this.context.value.transactionData.chainSelected
                          ].tokens[
                            this.context.value.transactionData.tokenSelected
                          ].symbol
                        }
                      </Text>
                    </View>
                  </View>
                  {this.context.value.transactionData.withSavings &&
                    this.context.value.transactionData.walletSelector === 0 && (
                      <View style={[GlobalStyles.network]}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-around",
                          }}
                        >
                          <View style={{ marginHorizontal: 20 }}>
                            <Text style={{ fontSize: 20, color: textColor }}>
                              Transaction
                            </Text>
                            <Text style={{ fontSize: 14, color: textColor }}>
                              savingsTransfer
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            marginHorizontal: 20,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View style={{ marginHorizontal: 10 }}>
                            {
                              blockchains[
                                this.context.value.transactionData.chainSelected
                              ].tokens[0].icon
                            }
                          </View>
                          <Text style={{ color: textColor }}>
                            {`${epsilonRound(
                              this.context.value.transactionData.savedAmount,
                              8
                            )}`}{" "}
                            {
                              blockchains[
                                this.context.value.transactionData.chainSelected
                              ].tokens[0].symbol
                            }
                          </Text>
                        </View>
                      </View>
                    )}
                </View>
                <View style={{ gap: 10, width: "100%", alignItems: "center" }}>
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyle,
                      this.state.loading ? { opacity: 0.5 } : {},
                    ]}
                    onPress={() => Linking.openURL(this.state.explorerURL)}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        fontWeight: "bold",
                        color: "white",
                        textAlign: "center",
                      }}
                    >
                      View on Explorer
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      GlobalStyles.buttonStyle,
                      {
                        backgroundColor: secondaryColor,
                        borderColor: secondaryColor,
                      },
                      this.state.loading === "" ? { opacity: 0.5 } : {},
                    ]}
                    onPress={async () => {
                      this.EventEmitter.emit("refresh");
                      this.context.setValue(
                        {
                          isTransactionActive: false,
                        },
                        () => this.setState(baseTransactionsModalState)
                      );
                    }}
                    disabled={this.state.loading}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 24,
                        fontWeight: "bold",
                      }}
                    >
                      Done
                    </Text>
                  </Pressable>
                </View>
              </React.Fragment>
            )}
          </View>
        </View>
      </Modal>
    );
  }
}

export default useHOCS(TransactionsModal);

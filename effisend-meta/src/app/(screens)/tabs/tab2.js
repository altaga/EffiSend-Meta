import { Contract, formatUnits } from "ethers";
import { fetch } from "expo/fetch";
import React, { Component, Fragment } from "react";
import {
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import VirtualKeyboard from "react-native-virtual-keyboard";
import checkMark from "../../../assets/images/checkMark.png";
import { logo } from "../../../assets/images/logo";
import CamFace from "../../../components/camFace";
import CamQR from "../../../components/camQR";
import { abiBatchTokenBalances } from "../../../contracts/batchTokenBalances";
import { blockchains } from "../../../core/constants";
import GlobalStyles, {
  mainColor,
  secondaryColor,
  tertiaryColor,
} from "../../../core/styles";
import {
  deleteLeadingZeros,
  formatInputText,
  normalizeFontSize,
  rgbaToHex,
  setupProvider,
} from "../../../core/utils";
import ContextModule from "../../../providers/contextModule";
import { useHOCS } from "../../../hocs/useHOCS";

const BaseStatePaymentWallet = {
  // Base
  balances: blockchains.map((x) => x.tokens.map(() => 0)),
  activeTokens: blockchains.map((x) => x.tokens.map(() => false)),
  stage: 0, // 0
  amount: "0.00", // "0.00"
  kindPayment: 0, // 0
  // wallets
  wallets: new Array(blockchains.length).fill(""),
  user: "",
  address: "",
  // Extra
  explorerURL: "",
  hash: "",
  transactionDisplay: {
    amount: "0.00",
    name: blockchains[0].tokens[0].symbol,
    tokenAddress: blockchains[0].tokens[0].address,
    icon: blockchains[0].tokens[0].icon,
  },
  // QR print
  saveData: "",
  // Utils
  take: false,
  loading: false,
};

const sortByPriority = (array, key) => {
  return array.sort((a, b) => {
    const getPriority = (value) => {
      if (value.includes("USDC")) return 2; // Highest priority
      if (value.includes("EURC")) return 1; // Second priority
      return 0; // No priority
    };
    const priorityA = getPriority(a[key]);
    const priorityB = getPriority(b[key]);
    return priorityB - priorityA; // Sort descending by priority
  });
};

const plain = sortByPriority(
  blockchains
    .map((blockchain, i, arrayB) =>
      blockchain.tokens.map((token, j, arrayT) => {
        return {
          ...blockchain,
          ...token,
          i,
          j,
          arrayB: arrayB.length,
          arrayT: arrayT.length,
        };
      })
    )
    .flat(),
  "symbol"
);

class Tab2 extends Component {
  constructor(props) {
    super(props);
    this.state = BaseStatePaymentWallet;
    this.provider = blockchains.map((x) => setupProvider(x.rpc));
    this.controller = new AbortController();
    this.svg = null;
  }

  static contextType = ContextModule;

  async getDataURL() {
    return new Promise(async (resolve, reject) => {
      this.svg.toDataURL(async (data) => {
        this.setState(
          {
            saveData: data,
          },
          () => resolve("ok")
        );
      });
    });
  }

  async encryptData(data) {
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const raw = JSON.stringify({
        data,
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };

      fetch(`/api/encrypt`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch((error) => console.error(error));
    });
  }

  printURL() {
    window.open(
      `http://localhost:8081/receipt?kindPayment=${this.state.kindPayment}&amount=${this.state.transactionDisplay.amount}&name=${this.state.transactionDisplay.name}&hash=${this.state.hash}`,
      "_blank"
    );
  }

  componentDidMount() {
    this.props.navigation.addListener("focus", async () => {
      this.setState(BaseStatePaymentWallet);
    });
  }
  async payFromAnySource(i, j) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const { data: user } = await this.encryptData(this.state.user);
    const raw = JSON.stringify({
      user,
      command: j === 0 ? "transfer" : "tokenTransfer",
      chain: i,
      token: j,
      amount: (
        this.state.amount / this.context.value.usdConversion[i][j]
      ).toFixed(blockchains[i].tokens[j].decimals),
      destinationAddress: this.props.account,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    fetch(`/api/submitPayment`, requestOptions)
      .then((response) => response.json())
      .then(async (result) => {
        console.log(result.result);
        if (result.result.error === null) {
          await this.setStateAsync({
            status: "Confirmed",
            loading: false,
            explorerURL: `${blockchains[i].blockExplorer}tx/${result.result.result}`,
            hash: result.result.result,
          });
        }
      })
      .catch((error) => console.error(error));
  }

  async getAddressFrom(kind, data) {
    let raw;
    if (kind === 0) {
      const { data: nonce } = await this.encryptData(data);
      raw = JSON.stringify({
        nonce,
      });
    } else if (kind === 1) {
      const { data: user } = await this.encryptData(data);
      raw = JSON.stringify({
        user,
      });
    }
    return new Promise((resolve, reject) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };

      fetch("/api/fetchPayment", requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result.result))
        .catch((error) => console.error(error));
    });
  }

  async getBalances() {
    const tokensArrays = blockchains
      .map((x) =>
        x.tokens.filter(
          (token) =>
            token.address !== "0x0000000000000000000000000000000000000000"
        )
      )
      .map((x) => x.map((y) => y.address));
    const batchBalancesContracts = blockchains.map(
      (x, i) =>
        new Contract(
          x.batchBalancesAddress,
          abiBatchTokenBalances,
          this.provider[i]
        )
    );
    const nativeBalances = await Promise.all(
      this.provider.map((x, i) => x.getBalance(this.state.wallets[i]) ?? 0n)
    );
    const tokenBalances = await Promise.all(
      batchBalancesContracts.map(
        (x, i) =>
          x.batchAllowanceOf(
            this.state.address,
            this.state.wallets[i],
            tokensArrays[i]
          ) ?? 0n
      )
    );
    let balancesMerge = [];
    nativeBalances.forEach((x, i) =>
      balancesMerge.push([x, ...tokenBalances[i]])
    );
    const balances = blockchains.map((x, i) =>
      x.tokens.map((y, j) => {
        return formatUnits(balancesMerge[i][j], y.decimals);
      })
    );
    const activeTokens = balances.map((tokens, i) =>
      tokens.map(
        (balance, j) =>
          balance >
          parseFloat(deleteLeadingZeros(formatInputText(this.state.amount))) /
            this.context.value.usdConversion[i][j]
      )
    );
    await this.setStateAsync({
      balances,
      activeTokens,
      stage: 2,
      loading: false,
    });
  }

  async findUserFaceID(image) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      image,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/getFaceID`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch(() => resolve(null));
    });
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
      <Fragment>
        <View style={[GlobalStyles.main]}>
          {this.state.stage === 0 && (
            <View
              style={{
                height: "100%",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 10,
              }}
            >
              <Text style={GlobalStyles.title}>Enter Amount (USD)</Text>
              <Text style={{ fontSize: 36, color: "white" }}>
                {deleteLeadingZeros(formatInputText(this.state.amount))}
              </Text>
              <VirtualKeyboard
                style={{
                  fontSize: 40,
                  textAlign: "center",
                  marginTop: -10,
                }}
                cellStyle={{
                  width: normalizeFontSize(100),
                  height: normalizeFontSize(50),
                  borderWidth: 1,
                  borderColor: rgbaToHex(255, 255, 255, 20),
                  borderRadius: 5,
                  margin: 3,
                }}
                rowStyle={{
                  width: "100%",
                }}
                color="white"
                pressMode="string"
                onPress={(amount) => this.setState({ amount })}
                decimal
              />
              <View
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  width: "100%",
                }}
              >
                <Pressable
                  style={[
                    GlobalStyles.buttonStyle,
                    {
                      backgroundColor: secondaryColor,
                      borderColor: secondaryColor,
                    },
                  ]}
                  onPress={() => this.setState({ stage: 1, kindPayment: 0 })}
                >
                  <Text style={GlobalStyles.buttonText}>Pay with QR</Text>
                </Pressable>
                <Pressable
                  style={[
                    GlobalStyles.buttonStyle,
                    {
                      backgroundColor: tertiaryColor,
                      borderColor: tertiaryColor,
                    },
                  ]}
                  onPress={() => this.setState({ stage: 1, kindPayment: 1 })}
                >
                  <Text style={GlobalStyles.buttonText}>Pay with FaceID</Text>
                </Pressable>
              </View>
            </View>
          )}
          {this.state.stage === 1 && this.state.kindPayment === 0 && (
            <View
              style={{
                height: "100%",
                width: "90%",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 30,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={GlobalStyles.title}>Amount (USD)</Text>
                <Text style={{ fontSize: 36, color: "white" }}>
                  $ {deleteLeadingZeros(formatInputText(this.state.amount))}
                </Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={GlobalStyles.title}>QR Code</Text>
              </View>
              <View
                style={{
                  height: "auto",
                  width: "80%",
                  marginVertical: 20,
                  borderColor: secondaryColor,
                  borderWidth: 5,
                  borderRadius: 10,
                  aspectRatio: 1,
                }}
              >
                <CamQR
                  facing={"back"}
                  callbackAddress={async (nonce) => {
                    try {
                      const { wallets, address, user } =
                        await this.getAddressFrom(0, nonce);
                      await this.setStateAsync({ wallets, address, user });
                      await this.getBalances();
                    } catch (error) {
                      console.log(error);
                      this.setState(BaseStatePaymentWallet);
                    }
                  }}
                />
              </View>
              <View
                key={"This element its only to align the NFC reader in center"}
              />
            </View>
          )}
          {this.state.stage === 1 && this.state.kindPayment === 1 && (
            <View
              style={{
                height: "100%",
                width: "90%",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 30,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={GlobalStyles.title}>Amount (USD)</Text>
                <Text style={{ fontSize: 36, color: "white" }}>
                  $ {deleteLeadingZeros(formatInputText(this.state.amount))}
                </Text>
              </View>
              <View>
                <Text style={{ color: "white", fontSize: 28 }}>FaceID</Text>
              </View>
              <View
                style={{
                  height: "auto",
                  width: "80%",
                  marginVertical: 20,
                  borderColor: secondaryColor,
                  borderWidth: 5,
                  borderRadius: 10,
                  aspectRatio: 1,
                }}
              >
                <CamFace
                  facing={"back"}
                  take={this.state.take}
                  onImage={async (image) => {
                    try {
                      const { result: user } = await this.findUserFaceID(image);
                      const { wallets, address } = await this.getAddressFrom(
                        1,
                        user
                      );
                      await this.setStateAsync({ wallets, address, user });
                      await this.getBalances();
                    } catch (error) {
                      console.log(error);
                      this.setState(BaseStatePaymentWallet);
                    }
                  }}
                />
              </View>
              <Pressable
                disabled={this.state.loading}
                style={[
                  GlobalStyles.buttonStyle,
                  this.state.loading ? { opacity: 0.5 } : {},
                ]}
                onPress={() =>
                  this.setState({ take: true, loading: true }, () => {
                    this.setState({
                      take: false,
                    });
                  })
                }
              >
                <Text style={[GlobalStyles.buttonText]}>
                  {this.state.loading ? "Processing..." : "Take Picture"}
                </Text>
              </Pressable>
            </View>
          )}
          {this.state.stage === 2 && (
            <React.Fragment>
              <Text
                style={{
                  fontSize: 28,
                  color: "white",
                  textAlign: "center",
                }}
              >
                {this.state.address.substring(0, 6)}...
                {this.state.address.substring(this.state.address.length - 4)}
              </Text>
              <Text style={[GlobalStyles.titlePaymentToken]}>
                Select Payment Token
              </Text>
              <ScrollView style={{ width: "90%" }}>
                {plain.map((token, i) =>
                  this.state.activeTokens[token.i][token.j] ? (
                    <View
                      key={`${token.name}-${token.i}-${token.j}`}
                      style={{
                        paddingBottom:
                          token.arrayB === token.i + 1 &&
                          token.arrayT === token.j + 1
                            ? 0
                            : 20,
                        marginBottom: 20,
                      }}
                    >
                      <Pressable
                        disabled={this.state.loading}
                        style={[
                          GlobalStyles.buttonStyle,
                          this.state.loading ? { opacity: 0.5 } : {},
                          (token.symbol === "USDC" ||
                            token.symbol === "EURC") && {
                            backgroundColor: "#2775ca",
                            borderColor: "#2775ca",
                          },
                        ]}
                        onPress={async () => {
                          try {
                            await this.setStateAsync({
                              transactionDisplay: {
                                amount: (
                                  this.state.amount /
                                  this.context.value.usdConversion[token.i][
                                    token.j
                                  ]
                                ).toFixed(6),
                                name: token.symbol,
                                icon: token.icon,
                              },
                              status: "Processing...",
                              stage: 3,
                              explorerURL: "",
                              loading: true,
                            });
                            await this.payFromAnySource(token.i, token.j);
                          } catch (error) {
                            console.log(error);
                            await this.setStateAsync({ loading: false });
                          }
                        }}
                      >
                        <Text style={GlobalStyles.buttonText}>
                          {token.name}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Fragment key={`${token.name}-${token.i}-${token.j}`} />
                  )
                )}
              </ScrollView>
            </React.Fragment>
          )}
          {
            // Stage 3
            this.state.stage === 3 && (
              <View
                style={{
                  paddingTop: 10,
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "space-between",
                }}
              >
                <Image
                  source={checkMark}
                  alt="check"
                  style={{ width: "60%", height: "auto", aspectRatio: 1 }}
                />
                <Text
                  style={{
                    textShadowRadius: 1,
                    fontSize: 28,
                    fontWeight: "bold",
                    color:
                      this.state.explorerURL === ""
                        ? secondaryColor
                        : mainColor,
                  }}
                >
                  {this.state.explorerURL === ""
                    ? "Processing..."
                    : "Completed"}
                </Text>
                <View
                  style={[
                    GlobalStyles.networkShow,
                    {
                      width: "100%",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-around",
                    }}
                  >
                    <View style={{ marginHorizontal: 20 }}>
                      <Text style={{ fontSize: 20, color: "white" }}>
                        Transaction
                      </Text>
                      <Text style={{ fontSize: 14, color: "white" }}>
                        {this.state.kindPayment === 1
                          ? "QR Payment"
                          : "FaceID Payment"}
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
                      {this.state.transactionDisplay.icon}
                    </View>
                    <Text style={{ color: "white" }}>
                      {`${deleteLeadingZeros(
                        formatInputText(this.state.transactionDisplay.amount)
                      )}`}{" "}
                      {this.state.transactionDisplay.name}
                    </Text>
                  </View>
                </View>
                <View style={GlobalStyles.buttonContainer}>
                  <Pressable
                    disabled={this.state.explorerURL === ""}
                    style={[
                      GlobalStyles.buttonStyle,
                      this.state.explorerURL === ""
                        ? { opacity: 0.5, borderColor: "black" }
                        : {},
                    ]}
                    onPress={() => Linking.openURL(this.state.explorerURL)}
                  >
                    <Text style={GlobalStyles.buttonText}>
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
                      this.state.explorerURL === ""
                        ? { opacity: 0.5, borderColor: "black" }
                        : {},
                    ]}
                    onPress={async () => {
                      this.printURL(this.state.explorerURL);
                    }}
                    disabled={this.state.explorerURL === ""}
                  >
                    <Text style={GlobalStyles.buttonText}>Show Receipt</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      GlobalStyles.buttonStyle,
                      {
                        backgroundColor: tertiaryColor,
                        borderColor: tertiaryColor,
                      },
                      this.state.explorerURL === ""
                        ? { opacity: 0.5, borderColor: "black" }
                        : {},
                    ]}
                    onPress={async () => {
                      this.setState({
                        stage: 0,
                        explorerURL: "",
                        check: "Check",
                        errorText: "",
                        amount: "0.00", // "0.00"
                      });
                    }}
                    disabled={this.state.explorerURL === ""}
                  >
                    <Text style={GlobalStyles.buttonText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
        </View>
      </Fragment>
    );
  }
}

export default useHOCS(Tab2);

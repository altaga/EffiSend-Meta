import { Picker } from "@react-native-picker/picker";
import {
  Contract,
  ethers,
  formatUnits,
  Interface,
  parseEther,
  parseUnits,
  randomBytes,
  uuidV4,
} from "ethers";
import { LinearGradient } from "expo-linear-gradient";
import { fetch } from "expo/fetch";
import { Component, Fragment } from "react";
import {
  Keyboard,
  NativeEventEmitter,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import QRCodeStyled from "react-native-qrcode-styled";
import { Toast } from "toastify-react-native";
import CamFace from "../../../components/camFace";
import { abiBatchTokenBalances } from "../../../contracts/batchTokenBalances";
import { abiERC20 } from "../../../contracts/erc20";
import { blockchains, refreshTime } from "../../../core/constants";
import GlobalStyles, { mainColor, secondaryColor } from "../../../core/styles";
import {
  arraySum,
  epsilonRound,
  getAsyncStorageValue,
  getEncryptedStorageValue,
  normalizeFontSize,
  setAsyncStorageValue,
  setChains,
  setEncryptedStorageValue,
  setTokens,
  setupProvider,
} from "../../../core/utils";
import { useHOCS } from "../../../hocs/useHOCS";
import ContextModule from "../../../providers/contextModule";

const baseTab1State = {
  // Transaction settings
  amount: "",
  chainSelected: setChains(blockchains)[0], // ""
  tokenSelected: setTokens(blockchains[0].tokens)[0], // ""
  loading: false,
  take: false,
  keyboardHeight: 0,
  selector: 0,
  qrData: "",
  cameraDelayLoading: false, // Force the camera to load when component is mounted and helps UX
};

class Tab1 extends Component {
  constructor(props) {
    super(props);
    this.state = baseTab1State;
    this.provider = blockchains.map((x) => setupProvider(x.rpc));
    this.EventEmitter = new NativeEventEmitter();
    this.controller = new AbortController();
  }

  static contextType = ContextModule;

  async getlastRefresh() {
    try {
      const lastRefresh = await getAsyncStorageValue("lastRefresh");
      if (lastRefresh === null) throw "Set First Date";
      return lastRefresh;
    } catch (err) {
      await setAsyncStorageValue({ lastRefresh: 0 });
      return 0;
    }
  }

  async componentDidMount() {
    const interval = setInterval(async () => {
      const publicKey = this.context.value.wallets.eth.address;
      if (publicKey !== "") {
        console.log(publicKey);
        clearInterval(interval);
        // Event Emitter
        this.EventEmitter.addListener("refresh", async () => {
          Keyboard.dismiss();
          await this.setStateAsync(baseTab1State);
          await setAsyncStorageValue({ lastRefresh: Date.now() });
          this.refresh();
        });
        // Get Last Refresh
        const lastRefresh = await this.getlastRefresh();
        if (Date.now() - lastRefresh >= refreshTime) {
          console.log("Refreshing...");
          await setAsyncStorageValue({ lastRefresh: Date.now() });
          this.refresh();
        } else {
          console.log(
            `Next refresh Available: ${Math.round(
              (refreshTime - (Date.now() - lastRefresh)) / 1000
            )} Seconds`
          );
        }
      }
    }, 1000);
    setTimeout(() => this.setState({ cameraDelayLoading: true }), 1);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.account !== this.props.account && this.props.account) {
    }
  }

  componentWillUnmount() {
    this.EventEmitter.removeAllListeners("refresh");
  }

  async getUSD() {
    const array = blockchains
      .map((x) => x.tokens.map((token) => token.coingecko))
      .flat();
    var myHeaders = new Headers();
    myHeaders.append("accept", "application/json");
    var requestOptions = {
      signal: this.controller.signal,
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${array.toString()}&vs_currencies=usd`,
      requestOptions
    );
    const result = await response.json();
    const usdConversionTemp = array.map((x) => result[x].usd);
    let acc = 0;
    const usdConversion = blockchains.map((blockchain) =>
      blockchain.tokens.map(() => {
        acc++;
        return usdConversionTemp[acc - 1];
      })
    );
    setAsyncStorageValue({ usdConversion });
    this.context.setValue({ usdConversion });
  }

  async refresh() {
    await this.setStateAsync({ refreshing: true });
    try {
      await Promise.all([this.getUSD(), this.getBalance()]);
    } catch (e) {
      console.log(e);
    }
    await this.setStateAsync({ refreshing: false });
  }

  async getBalance() {
    const balances = await this.getBatchBalances();
    setAsyncStorageValue({ balances });
    this.context.setValue({ balances });
  }

  async getBatchBalances() {
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
      this.provider.map(
        (x, i) =>
          x.getBalance(
            this.context.value.wallets[blockchains[i].apiname].address
          ) ?? 0n
      )
    );
    const tokenBalances = await Promise.all(
      batchBalancesContracts.map(
        (x, i) =>
          x.batchAllowanceOf(
            this.props.account,
            this.context.value.wallets[blockchains[i].apiname].address,
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
    return balances;
  }

  async faceRegister(image, address) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify({
      address,
      image,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/createFaceID`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result))
        .catch(() => resolve(null));
    });
  }

  async didRegister() {
    return new Promise(async (resolve) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      const address = this.props.account;
      const raw = JSON.stringify({
        kind:"did",
        address,
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };
      fetch(`/api/createWallets`, requestOptions)
        .then((response) => response.json())
        .then((result) => {
          resolve(result);
        })
        .catch((e) => {
          console.log(e);
        });
    });
  }

  createWallet(image) {
    this.setState({
      loading: true,
    });
    setTimeout(async () => {
      try {
        const {
          result: { user, wallets },
        } = await this.didRegister();
        const res = await this.faceRegister(image, user);
        if (
          res.result === "Address already exists" ||
          res === null ||
          res.result === "User already exists"
        ) {
          throw "User already exists";
        }
        await setEncryptedStorageValue({
          user,
        });
        await setAsyncStorageValue({
          wallets,
        });
        this.context.setValue({
          wallets,
        });
        await this.setStateAsync({
          loading: false,
        });
        Toast.show({
          type: "info",
          text1: "You have won EFS tokens because you verified",
          text2: "Go to the Effisend ID tab to claim",
          position: "bottom",
          visibilityTime: 10000,
          autoHide: true,
        });
        this.componentDidMount();
      } catch (e) {
        console.log(e);
      }
    }, 100);
  }

  async createPayment(tempNonce) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const tempUser =  await getEncryptedStorageValue("user");
    const raw = JSON.stringify({
      nonce:tempNonce,
      user:tempUser,
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    return new Promise((resolve) => {
      fetch(`/api/createPayment`, requestOptions)
        .then((response) => response.json())
        .then((result) => resolve(result.result))
        .catch(() => resolve(null));
    });
  }

  async createQR() {
    this.setState({
      loading: true,
    });
    const bytes = randomBytes(16);
    const noncePayment = uuidV4(bytes);
    const { res } = await this.createPayment(noncePayment);
    if (res === "BAD REQUEST") {
      await this.setStateAsync({
        loading: false,
      });
      return;
    }
    this.setState({
      loading: false,
      qrData: noncePayment,
    });
  }

  async addBalance() {
    const label =
      this.state.tokenSelected.index === 0 ? "transfer" : "tokenTransfer";
    let transaction = {};
    if (label === "transfer") {
      transaction = {
        from: this.props.account,
        to: this.context.value.wallets[this.state.chainSelected.apiname]
          .address,
        value: parseEther(this.state.amount),
      };
    } else if (label === "tokenTransfer") {
      const tokenInterface = new Interface(abiERC20);
      transaction = {
        from: this.props.account,
        to: this.state.tokenSelected.address,
        data: tokenInterface.encodeFunctionData("approve", [
          this.context.value.wallets[this.state.chainSelected.apiname].address,
          parseUnits(this.state.amount, this.state.tokenSelected.decimals),
        ]),
      };
    }
    const provider = new ethers.BrowserProvider(this.props.provider);
    const signer = await provider.getSigner();
    const tx = await signer.sendTransaction(transaction);
    await tx.wait();
    this.EventEmitter.emit("refresh");
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

  render() {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          this.context.value.publicKey !== "" && (
            <RefreshControl
              progressBackgroundColor={mainColor}
              refreshing={this.state.refreshing}
              onRefresh={async () => {
                await setAsyncStorageValue({
                  lastRefresh: Date.now().toString(),
                });
                await this.refresh();
              }}
            />
          )
        }
        style={GlobalStyles.scrollContainer}
        contentContainerStyle={[
          GlobalStyles.scrollContainer,
          {
            height: "100%",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: normalizeFontSize(40),
            width: "90%",
            marginLeft: "5%",
            marginBottom: normalizeFontSize(40),
          },
        ]}
      >
        {this.context.value.wallets.eth.address !== "" ? (
          <Fragment>
            <LinearGradient
              style={{
                justifyContent: "center",
                alignItems: "center",
                width: "110%",
                marginTop: 20,
              }}
              colors={["#000000", "#010101", "#1a1a1a", "#010101", "#000000"]}
            >
              <Text style={[GlobalStyles.title]}>FaceID Balance</Text>
              <Text style={[GlobalStyles.balance]}>
                {`$ ${epsilonRound(
                  arraySum(
                    this.context.value.balances
                      .map((blockchain, i) =>
                        blockchain.map(
                          (token, j) =>
                            token * this.context.value.usdConversion[i][j]
                        )
                      )
                      .flat()
                  ),
                  2
                )} USD`}
              </Text>
            </LinearGradient>
            <View
              style={{
                flexDirection: "row",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Pressable
                disabled={this.state.loading}
                style={[
                  GlobalStyles.buttonSelectorSelectedStyle,
                  this.state.selector !== 0 && {
                    borderColor: "#aaaaaa",
                  },
                ]}
                onPress={async () => {
                  this.setState({ selector: 0 });
                }}
              >
                <Text style={[GlobalStyles.buttonTextSmall]}>Tokens</Text>
              </Pressable>
              <Pressable
                disabled={this.state.loading}
                style={[
                  GlobalStyles.buttonSelectorSelectedStyle,
                  this.state.selector !== 1 && {
                    borderColor: "#aaaaaa",
                  },
                ]}
                onPress={async () => {
                  this.setState({ selector: 1 });
                }}
              >
                <Text style={[GlobalStyles.buttonTextSmall]}>Add Balance</Text>
              </Pressable>
              <Pressable
                disabled={this.state.loading}
                style={[
                  GlobalStyles.buttonSelectorSelectedStyle,
                  this.state.selector !== 2 && {
                    borderColor: "#aaaaaa",
                  },
                ]}
                onPress={async () => {
                  this.setState({ selector: 2 });
                }}
              >
                <Text style={[GlobalStyles.buttonTextSmall]}>QR Pay</Text>
              </Pressable>
            </View>
            {this.state.selector === 0 && (
              <View
                style={{ marginTop: 0, width: "110%", alignItems: "center" }}
              >
                {blockchains.map((blockchain, i) =>
                  blockchain.tokens.map((token, j) => (
                    <View key={`${i}${j}`} style={GlobalStyles.network}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-around",
                        }}
                      >
                        <View style={GlobalStyles.networkMarginIcon}>
                          <View>{token.icon}</View>
                        </View>
                        <View style={{ justifyContent: "center" }}>
                          <Text style={GlobalStyles.networkTokenName}>
                            {token.name}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "flex-start",
                            }}
                          >
                            <Text style={GlobalStyles.networkTokenData}>
                              {this.context.value.balances[i][j] === 0
                                ? "0"
                                : this.context.value.balances[i][j] < 0.001
                                ? "<0.01"
                                : epsilonRound(
                                    this.context.value.balances[i][j],
                                    2
                                  )}{" "}
                              {token.symbol}
                            </Text>
                            <Text style={GlobalStyles.networkTokenData}>
                              {`  -  ($${epsilonRound(
                                this.context.value.usdConversion[i][j],
                                4
                              )} USD)`}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={{ marginHorizontal: 20 }}>
                        <Text style={{ color: "white" }}>
                          $
                          {epsilonRound(
                            this.context.value.balances[i][j] *
                              this.context.value.usdConversion[i][j],
                            2
                          )}{" "}
                          USD
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
            {this.state.selector === 1 && (
              <View
                style={{
                  justifyContent: "flex-start",
                  alignItems: "center",
                  width: "100%",
                  gap: 10,
                }}
              >
                <Text style={GlobalStyles.formTitleCard}>Amount</Text>
                <TextInput
                  style={[GlobalStyles.input]}
                  keyboardType="decimal-pad"
                  value={this.state.amount}
                  onChangeText={(value) => this.setState({ amount: value })}
                />
                <Text style={GlobalStyles.formTitleCard}>Select Network</Text>
                <Picker
                  style={[GlobalStyles.picker]}
                  selectedValue={this.state.chainSelected.index}
                  onValueChange={(i, _) => {
                    this.setState({
                      chainSelected: setChains(blockchains)[i],
                      tokenSelected: setTokens(blockchains[i].tokens)[0],
                    });
                  }}
                >
                  {blockchains.map((blockchain, i) => (
                    <Picker.Item key={i} label={blockchain.network} value={i} />
                  ))}
                </Picker>
                <Text style={GlobalStyles.formTitleCard}>Select Token</Text>
                <Picker
                  style={[GlobalStyles.picker]}
                  selectedValue={this.state.tokenSelected.index}
                  onValueChange={(i, _) => {
                    this.setState({
                      tokenSelected: setTokens(
                        blockchains[this.state.chainSelected.index].tokens
                      )[i],
                    });
                  }}
                >
                  {this.state.chainSelected.tokens.map((token, i) => (
                    <Picker.Item key={i} label={token.name} value={i} />
                  ))}
                </Picker>
                <View
                  style={{
                    width: "100%",
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyle,
                      {
                        width: "100%",
                        padding: 10,
                        marginVertical: 25,
                      },
                      this.state.loading ? { opacity: 0.5 } : {},
                    ]}
                    onPress={async () => {
                      await this.setStateAsync({ loading: true });
                      await this.addBalance();
                      await this.setStateAsync({
                        loading: false,
                      });
                    }}
                  >
                    <Text style={[GlobalStyles.buttonText]}>
                      {this.state.loading ? "Adding..." : "Add"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            {this.state.selector === 2 && (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 20,
                  width: "90%",
                  height: "100%",
                }}
              >
                {this.state.qrData === "" ? (
                  <Pressable
                    disabled={this.state.loading}
                    style={[
                      GlobalStyles.buttonStyle,
                      this.state.loading ? { opacity: 0.5 } : {},
                    ]}
                    onPress={() => this.createQR()}
                  >
                    <Text style={[GlobalStyles.buttonText]}>
                      {this.state.loading ? "Creating..." : "Create QR Payment"}
                    </Text>
                  </Pressable>
                ) : (
                  <Fragment>
                    <Text style={GlobalStyles.formTitleCard}>Payment QR</Text>
                    <QRCodeStyled
                      data={this.state.qrData}
                      style={[
                        {
                          backgroundColor: "white",
                          borderRadius: 10,
                        },
                      ]}
                      errorCorrectionLevel="H"
                      padding={16}
                      pieceSize={normalizeFontSize(7)}
                      pieceBorderRadius={4}
                      isPiecesGlued
                      color={"black"}
                    />
                  </Fragment>
                )}
              </View>
            )}
          </Fragment>
        ) : (
          <View
            style={[
              GlobalStyles.scrollContainer,
              {
                height: "100%",
                width: "90%",
                justifyContent: "space-around",
                alignItems: "center",
              },
            ]}
          >
            <View>
              <Text style={GlobalStyles.title}>FaceID</Text>
            </View>
            <View
              style={{
                height: "70%",
                width: "100%",
                borderColor: secondaryColor,
                borderWidth: 5,
                borderRadius: 10,
              }}
            >
              {this.state.cameraDelayLoading && (
                <CamFace
                  facing={"front"}
                  take={this.state.take}
                  onImage={(image) => {
                    this.createWallet(image);
                  }}
                />
              )}
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
                {this.state.loading ? "Creating..." : "Create Account"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }
}

export default useHOCS(Tab1);

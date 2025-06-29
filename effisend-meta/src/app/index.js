// Basic Imports
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Component } from "react";
import { Image, View } from "react-native";
import logoSplash from "../assets/images/splash-iconC.png";
import GlobalStyles from "../core/styles";
import { getAsyncStorageValue, getEncryptedStorageValue } from "../core/utils";
import { useHOCS } from "../hocs/useHOCS";
import ContextModule from "../providers/contextModule";

class SplashLoading extends Component {
  constructor(props) {
    super(props);
  }

  static contextType = ContextModule;

  async componentDidMount() {
    const myWallets = {}
    this.props.navigation.addListener("focus", async () => {
      console.log(this.props.route);
      console.log("Setup Correct");
      const wallets = await getAsyncStorageValue("wallets");
      console.log(wallets);
      const user = await getEncryptedStorageValue("user");
      console.log(user);
      const balances = await getAsyncStorageValue("balances");
      const usdConversion = await getAsyncStorageValue("usdConversion");
      this.context.setValue({
        // Base Wallet
        wallets: wallets ?? this.context.value.wallets,
        balances: balances ?? this.context.value.balances,
        // Shared
        usdConversion: usdConversion ?? this.context.value.usdConversion,
        // Setup
        starter: true,
      });
      this.props.navigation.navigate("(screens)/connect");
    });
    this.props.navigation.addListener("blur", async () => {});
  }

  async erase() {
    // DEV ONLY - DON'T USE IN PRODUCTION
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.log(error);
    }
  }

  render() {
    return (
      <View style={[GlobalStyles.container, { justifyContent: "center" }]}>
        <Image
          resizeMode="contain"
          source={logoSplash}
          alt="Main Logo"
          style={{
            width: "70%",
          }}
        />
      </View>
    );
  }
}

export default useHOCS(SplashLoading);

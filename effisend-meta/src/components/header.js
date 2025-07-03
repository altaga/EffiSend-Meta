import { Image, Pressable, Text, View } from "react-native";
import Renders from "../assets/images/logo.png";
import GlobalStyles, { header } from "../core/styles";
import { useMetaMask } from "../providers/metamaskProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useContext, useState } from "react";
import { getAsyncStorageValue, setAsyncStorageValue, setEncryptedStorageValue } from "../core/utils";
import ContextModule from "../providers/contextModule";

export default function Header() {
  const { sdk, connectWallet, disconnectWallet, isConnected } = useMetaMask();
  const [loading, setLoading] = useState(false);
  const context = useContext(ContextModule);

  const disconnectWalletFunction = async () => {
    setLoading(true);
    await disconnectWallet();
    await AsyncStorage.clear();
    setLoading(false);
  };

  const getSession = async (address, signature) => {
    return new Promise((resolve) => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      const raw = JSON.stringify({
        address,
        signature,
      });
      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow",
      };
      fetch("/api/signIn", requestOptions)
        .then((response) => response.json())
        .then((result) => {
          resolve({
            ...result,
          });
        })
        .catch((error) => {
          console.log("error", error);
          resolve(null);
        });
    });
  };

  const connectWalletFunction = async () => {
    setLoading(true);
    const signature = await sdk.connectAndSign({ msg: "Hello EffiSend" });
    await connectWallet();
    const accounts = await sdk.connect();
    const check = await getAsyncStorageValue("wallets");
    if (check === null) {
      const session = await getSession(accounts[0], signature);
      if (session.result !== null) {
        const user = session.result.result.user;
        const wallets = session.result.result.wallets;
        await setAsyncStorageValue({ wallets });
        await setEncryptedStorageValue({ user });
        context.setValue({ wallets });
      }
    }
    setLoading(false);
  };

  return (
    <View style={[GlobalStyles.header, { paddingHorizontal: 10 }]}>
      <View style={[GlobalStyles.headerItem, { alignItems: "flex-start" }]}>
        <Image
          source={Renders}
          alt="Logo"
          style={{
            height: header * 0.8,
            width: "auto",
            resizeMode: "contain",
            aspectRatio: 1,
          }}
        />
      </View>
      <View style={[GlobalStyles.headerItem, { alignItems: "flex-end" }]}>
        <Pressable
          disabled={loading}
          style={[
            GlobalStyles.buttonStyle,
            { borderRadius: 10 },
            isConnected || loading ? { opacity: 0.5 } : {}, // Use metamaskLoading
          ]}
          onPress={async () =>
            isConnected
              ? await disconnectWalletFunction()
              : await connectWalletFunction()
          } // Use the new handler function
        >
          <Text style={GlobalStyles.buttonText}>
            {isConnected ? "Disconnect" : "Connect"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

import Header from "@/src/components/header";
import { useCallback, useContext, useEffect } from "react";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import logo from "../../assets/images/splash-iconC.png";
import GlobalStyles from "../../core/styles";
import { useHOCS } from "../../hocs/useHOCS";
import { MetaMaskContext } from "../../providers/metamaskProvider";
import ContextModule from "../../providers/contextModule";

const ConnectComponent = ({ navigation }) => {
  const { isConnected } = useContext(MetaMaskContext);
  const {
    value: { starter },
  } = useContext(ContextModule);

  const checkConnected = useCallback(async () => {
    if (isConnected) {
      navigation.navigate("(screens)/main");
    }
    if (!starter) {
      navigation.navigate("index");
    }
  }, [isConnected]);

  useEffect(() => {
    console.log("Connect on Update");
    checkConnected();
  }, [isConnected]);

  return (
    <SafeAreaView style={[GlobalStyles.container]}>
      <Header />
      <View
        style={[
          GlobalStyles.main,
          { width: "70%", justifyContent: "space-evenly" },
        ]}
      >
        <Image
          source={logo}
          alt="Cat"
          style={{
            height: "auto",
            width: "100%",
            resizeMode: "contain",
            aspectRatio: 1,
          }}
        />
        <Text style={[GlobalStyles.title]}>
          Your face, your crypto. Secure and effortless payments.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const Connect = useHOCS(ConnectComponent);

export default Connect;

import { Image, Pressable, Text, View } from "react-native";
import Renders from "../assets/images/logo.png";
import GlobalStyles, { header } from "../core/styles";
import { useMetaMask } from "../providers/metamaskProvider";
  
export default function Header() {
  const { connectWallet, disconnectWallet, isConnected } = useMetaMask();

  return (
    <View style={[GlobalStyles.header, {paddingHorizontal: 10}]}>
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
          style={[
            GlobalStyles.buttonStyle,
            { borderRadius: 10 },
            isConnected ? { opacity: 0.5 } : {}, // Use metamaskLoading
          ]}
          onPress={async () =>
            isConnected
              ? await disconnectWallet()
              : await connectWallet()
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

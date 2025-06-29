import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useContext, useEffect, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import Header from "../../components/header";
import GlobalStyles, { iconSize, mainColor } from "../../core/styles";
import { useHOCS } from "../../hocs/useHOCS";
import ContextModule from "../../providers/contextModule";
import { useMetaMask } from "../../providers/metamaskProvider";
import Tab1 from "./tabs/tab1";
import Tab2 from "./tabs/tab2";

// Base state
const BaseStateMain = {
  tab: 0, // 0
};

const MainComponent = ({ navigation, route }) => {
  const [tab, setTab] = useState(BaseStateMain.tab);
  const { isConnected } = useMetaMask();
  const {
    value: { starter },
  } = useContext(ContextModule);

  const checkConnected = useCallback(async () => {
    if (!isConnected) {
      navigation.navigate("(screens)/connect");
    }
    if (!starter) {
      navigation.navigate("index");
    }
  }, [isConnected]);

  useEffect(() => {
    console.log("Main on Update");
    checkConnected();
  }, [isConnected]);

  const handleTabPress = (tabIndex) => {
    setTab(tabIndex);
  };

  return (
    <SafeAreaView style={[GlobalStyles.container]}>
      <Header />
      <View style={[GlobalStyles.main]}>
        {tab === 0 && <Tab1 navigation={navigation} />}
        {
          tab === 1 && <Tab2 navigation={navigation} />
        }
        {
          //tab === 2 && <Tab3 navigation={navigation} />
        }
        {
          //tab === 3 && <Tab4 navigation={navigation} />
        }
        {
          //tab === 4 && <Tab5 navigation={navigation} />
        }
      </View>
      <View style={[GlobalStyles.footer]}>
        <Pressable
          style={GlobalStyles.selector}
          onPress={() => handleTabPress(0)}
        >
          <MaterialIcons
            name="account-balance-wallet"
            size={iconSize}
            color={tab === 0 ? mainColor : "white"}
          />
          <Text
            style={
              tab === 0
                ? GlobalStyles.selectorSelectedText
                : GlobalStyles.selectorText
            }
          >
            User
          </Text>
        </Pressable>
        <Pressable
          style={GlobalStyles.selector}
          onPress={() => handleTabPress(1)}
        >
          <FontAwesome5
            name="coins"
            size={iconSize}
            color={tab === 1 ? mainColor : "white"}
          />
          <Text
            style={
              tab === 1
                ? GlobalStyles.selectorSelectedText
                : GlobalStyles.selectorText
            }
          >
            Business
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const Main = useHOCS(MainComponent);

export default Main;

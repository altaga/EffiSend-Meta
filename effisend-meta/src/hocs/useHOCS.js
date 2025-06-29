import {
  useGlobalSearchParams,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useMetaMask } from "../providers/metamaskProvider";

export const useHOCS = (Component) => {
  const getCurrentRoute = (navigation) => {
    const state = navigation.getState();
    const currentRoute = state.routes[state.index].name;
    return currentRoute;
  };

  return (props) => {
    const navigation = useNavigation();
    const route = getCurrentRoute(navigation);
    const glob = useGlobalSearchParams();
    const local = useLocalSearchParams();
    const { isConnected, account, provider } = useMetaMask();
    return (
      <Component
        glob={glob}
        local={local}
        navigation={navigation}
        route={route}
        isConnected={isConnected}
        account={account}
        provider={provider}
        {...props}
      />
    );
  };
};

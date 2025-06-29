import { ContextProvider } from "@/src/providers/contextModule";
import { MetaMaskProvider } from "@/src/providers/metamaskProvider";
import SmartProvider from "@/src/providers/smartProvider";
import {
  Exo2_400Regular,
  Exo2_700Bold,
  useFonts,
} from "@expo-google-fonts/exo-2";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import TransactionsModal from "../providers/transactionsModal";

import React from "react";

export default function RootLayout() {
  useFonts({
    Exo2_400Regular,
    Exo2_700Bold,
  });
  return (
    <React.Fragment>
      {
        // This provider put a phone frame around the app if the app is running on a desktop
      }
      <SmartProvider>
        {
          // This provider provides the context to the app
        }
        <ContextProvider>
          {
            // This provider provides metamask connectivity
          }
          <MetaMaskProvider>
            {
              // Transaction Modal Provider
            }
            <TransactionsModal />
            <Stack
              initialRouteName="index"
              screenOptions={{
                animation: "simple_push",
                headerShown: false,
              }}
            >
              {
                // Splash Loading Screen
              }
              <Stack.Screen name="index" />
              {
                // Setup Screen
              }
              <Stack.Screen name="(screens)/connect" />
              {
                // Main Screen
              }
              <Stack.Screen name="(screens)/main" />
            </Stack>
            <StatusBar style="auto" />
          </MetaMaskProvider>
        </ContextProvider>
      </SmartProvider>
    </React.Fragment>
  );
}

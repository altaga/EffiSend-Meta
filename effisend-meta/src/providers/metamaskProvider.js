import { MetaMaskSDK } from "@metamask/sdk"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

// Constants
const STORAGE_KEYS = {
  LAST_CONNECTED_ACCOUNT: "@metamask_last_connected_account",
  CONNECTION_PREFERENCE: "@metamask_connection_preference",
}

const DEFAULT_DAPP_METADATA = {
  name: "My DApp",
  url: "https://mydapp.com",
}

// Create the context
export const MetaMaskContext = createContext(null)

export const MetaMaskProvider = ({ children, dappMetadata = DEFAULT_DAPP_METADATA }) => {
  // Refs
  const sdkRef = useRef(null)
  const providerRef = useRef(null)
  const initializationAttempts = useRef(0)
  const maxInitializationAttempts = 3

  // State
  const [isConnected, setIsConnected] = useState(false)
  const [account, setAccount] = useState(null)
  const [currentChainId, setCurrentChainId] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSdkReady, setIsSdkReady] = useState(false)

  // Clear error function
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Save connection state to AsyncStorage
  const saveConnectionState = useCallback(async (accountAddress) => {
    try {
      if (accountAddress) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_CONNECTED_ACCOUNT, accountAddress)
        await AsyncStorage.setItem(STORAGE_KEYS.CONNECTION_PREFERENCE, "true")
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_CONNECTED_ACCOUNT)
        await AsyncStorage.removeItem(STORAGE_KEYS.CONNECTION_PREFERENCE)
      }
    } catch (err) {
      console.warn("Failed to save connection state:", err)
    }
  }, [])

  // Load connection preference from AsyncStorage
  const loadConnectionPreference = useCallback(async () => {
    try {
      const preference = await AsyncStorage.getItem(STORAGE_KEYS.CONNECTION_PREFERENCE)
      return preference === "true"
    } catch (err) {
      console.warn("Failed to load connection preference:", err)
      return false
    }
  }, [])

  // Event handlers
  const handleAccountsChanged = useCallback(
    (accounts) => {
      const newAccount = accounts[0] || null
      setAccount(newAccount)
      setIsConnected(!!newAccount)

      console.log("Accounts changed:", newAccount)

      // Save connection state
      saveConnectionState(newAccount)

      if (!newAccount) {
        setError(null) // Clear errors on disconnect
      }
    },
    [saveConnectionState],
  )

  const handleChainChanged = useCallback((chainId) => {
    setCurrentChainId(chainId)
    console.log("Chain changed:", chainId)
  }, [])

  const handleDisconnect = useCallback(
    (err) => {
      console.log("Wallet disconnected:", err)
      setAccount(null)
      setIsConnected(false)
      setCurrentChainId(null)
      setError(err?.message || null)
      saveConnectionState(null)
    },
    [saveConnectionState],
  )

  // Initialize SDK with retry logic
  const initializeSDK = useCallback(async () => {
    if (initializationAttempts.current >= maxInitializationAttempts) {
      setError("Failed to initialize MetaMask SDK after multiple attempts")
      setIsLoading(false)
      return false
    }

    initializationAttempts.current += 1
    console.log(`Initializing MetaMask SDK (attempt ${initializationAttempts.current})...`)

    try {
      setIsLoading(true)
      setError(null)

      const MMSDK = new MetaMaskSDK({
        dappMetadata,
        // Add any additional SDK options here
      })

      sdkRef.current = MMSDK
      await MMSDK.init()

      const ethereumProvider = MMSDK.getProvider()
      if (!ethereumProvider) {
        throw new Error("MetaMask provider not available after SDK initialization")
      }

      providerRef.current = ethereumProvider
      setIsSdkReady(true)

      // Set up event listeners
      ethereumProvider.on("accountsChanged", handleAccountsChanged)
      ethereumProvider.on("chainChanged", handleChainChanged)
      ethereumProvider.on("disconnect", handleDisconnect)

      // Check for existing connection
      const initialAccounts = await ethereumProvider.request({
        method: "eth_accounts",
      })

      if (initialAccounts && initialAccounts.length > 0) {
        const connectedAccount = initialAccounts[0]
        setAccount(connectedAccount)
        setIsConnected(true)
        await saveConnectionState(connectedAccount)
      } else {
        // Check if user previously wanted to stay connected
        const shouldAutoConnect = await loadConnectionPreference()
        if (shouldAutoConnect) {
          // Optionally attempt auto-connection here
          console.log("User previously connected, but no accounts found")
        }
      }

      setIsLoading(false)
      return true
    } catch (err) {
      console.error("Error initializing MetaMask SDK:", err)
      setError(err instanceof Error ? err.message : "Failed to initialize MetaMask SDK")
      setIsSdkReady(false)
      setIsLoading(false)
      return false
    }
  }, [
    dappMetadata,
    handleAccountsChanged,
    handleChainChanged,
    handleDisconnect,
    saveConnectionState,
    loadConnectionPreference,
  ])

  // Retry connection function
  const retryConnection = useCallback(async () => {
    initializationAttempts.current = 0 // Reset attempts
    await initializeSDK()
  }, [initializeSDK])

  // Connect wallet function
  const connectWallet = useCallback(async () => {
    if (!isSdkReady || !providerRef.current) {
      setError("MetaMask SDK not ready. Please wait or try again.")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const accounts = await providerRef.current.request({
        method: "eth_requestAccounts",
      })

      if (accounts && accounts.length > 0) {
        const connectedAccount = accounts[0]
        setAccount(connectedAccount)
        setIsConnected(true)
        await saveConnectionState(connectedAccount)
        console.log("Wallet connected:", connectedAccount)
      } else {
        throw new Error("No accounts returned after connection request")
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to connect to wallet"
      setError(errorMessage)
      setIsConnected(false)
      setAccount(null)
    } finally {
      setIsLoading(false)
    }
  }, [isSdkReady, saveConnectionState])

  // Disconnect wallet function
  const disconnectWallet = useCallback(async () => {
    setIsLoading(true)

    try {
      if (providerRef.current?.disconnect) {
        await providerRef.current.disconnect()
      }
    } catch (err) {
      console.warn("Provider disconnect failed (often expected):", err)
    }

    setAccount(null)
    setIsConnected(false)
    setCurrentChainId(null)
    setError(null)
    await saveConnectionState(null)
    setIsLoading(false)
  }, [saveConnectionState])

  // Initialize SDK on mount
  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (isMounted) {
        await initializeSDK()
      }
    }

    init()

    // Cleanup function
    return () => {
      isMounted = false

      // Remove event listeners
      if (providerRef.current) {
        try {
          providerRef.current.removeListener?.("accountsChanged", handleAccountsChanged)
          providerRef.current.removeListener?.("chainChanged", handleChainChanged)
          providerRef.current.removeListener?.("disconnect", handleDisconnect)
        } catch (err) {
          console.warn("Error removing event listeners:", err)
        }
      }

      // Terminate SDK
      if (sdkRef.current) {
        try {
          sdkRef.current.terminate?.()
        } catch (err) {
          console.warn("Error terminating SDK:", err)
        }
      }
    }
  }, [initializeSDK, handleAccountsChanged, handleChainChanged, handleDisconnect])

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      sdk: sdkRef.current,
      provider: providerRef.current,
      isConnected,
      account,
      currentChainId,
      error,
      isLoading,
      isSdkReady,
      connectWallet,
      disconnectWallet,
      clearError,
      retryConnection,
    }),
    [
      isConnected,
      account,
      currentChainId,
      error,
      isLoading,
      isSdkReady,
      connectWallet,
      disconnectWallet,
      clearError,
      retryConnection,
    ],
  )

  return <MetaMaskContext.Provider value={contextValue}>{children}</MetaMaskContext.Provider>
}

// Custom hook with better error handling
export const useMetaMask = () => {
  const context = useContext(MetaMaskContext)

  if (context === null) {
    throw new Error(
      "useMetaMask must be used within a MetaMaskProvider. " +
        "Make sure to wrap your component with <MetaMaskProvider>.",
    )
  }

  return context
}

// Additional utility hooks
export const useMetaMaskConnection = () => {
  const { isConnected, account, connectWallet, disconnectWallet, isLoading } = useMetaMask()

  return {
    isConnected,
    account,
    connectWallet,
    disconnectWallet,
    isLoading,
  }
}

export const useMetaMaskError = () => {
  const { error, clearError, retryConnection } = useMetaMask()

  return {
    error,
    clearError,
    retryConnection,
    hasError: !!error,
  }
}

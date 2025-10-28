import { useEffect, useRef, useState, useCallback } from "react"
import {
  detectAllWallets,
  DetectedWallet,
  isEVMProvider,
} from "@/misc/walletDetection"

type DeBridgeWidget = {
  setExternalEVMWallet: (config: {
    provider: any
    name: string
    imageSrc: string
  }) => void
  on: (eventName: string, callback: (...args: any[]) => void) => void
}

export function useBridgeWallets() {
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([])
  const [activeWallet, setActiveWallet] = useState<DetectedWallet | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const walletRegistered = useRef(false)
  const lastRegisteredWallet = useRef<string | null>(null)

  // Check if a wallet has active accounts
  const hasActiveAccounts = async (provider: any): Promise<boolean> => {
    try {
      if (provider.request) {
        const accounts = await provider.request({ method: "eth_accounts" })
        return Array.isArray(accounts) && accounts.length > 0
      }
      // Legacy support
      if (provider.selectedAddress) {
        return true
      }
      return false
    } catch (error) {
      console.debug("[useBridgeWallets] Failed to check accounts:", error)
      return false
    }
  }

  // Find the active (connected) wallet
  const findActiveWallet = async (wallets: DetectedWallet[]) => {
    for (const wallet of wallets) {
      const isActive = await hasActiveAccounts(wallet.provider)
      if (isActive) {
        console.debug(`[useBridgeWallets] Found active wallet: ${wallet.name}`)
        return wallet
      }
    }

    // If no active wallet found, return the first available (user can connect manually)
    if (wallets.length > 0) {
      console.debug(
        `[useBridgeWallets] No active wallet found, using first available: ${wallets[0].name}`
      )
      return wallets[0]
    }

    return null
  }

  // Detect all available wallets and find active one
  const detectWallets = async () => {
    if (isDetecting) return

    setIsDetecting(true)
    try {
      const wallets = await detectAllWallets()
      const evmWallets = wallets.filter((wallet) =>
        isEVMProvider(wallet.provider)
      )
      setDetectedWallets(evmWallets)

      // Find active wallet
      const active = await findActiveWallet(evmWallets)
      setActiveWallet(active)

      console.debug(
        `[useBridgeWallets] Detected ${evmWallets.length} EVM wallets, active: ${active?.name || "none"}`
      )
    } catch (error) {
      console.error("[useBridgeWallets] Failed to detect wallets:", error)
    } finally {
      setIsDetecting(false)
    }
  }

  // Register active wallet with deBridge widget
  const registerWalletWithWidget = useCallback(
    (widget: DeBridgeWidget, force = false) => {
      if (!activeWallet) {
        return
      }

      // Skip if same wallet is already registered and not forcing
      if (!force && lastRegisteredWallet.current === activeWallet.uuid) {
        return
      }

      try {
        widget.setExternalEVMWallet({
          provider: activeWallet.provider,
          name: activeWallet.name,
          imageSrc: activeWallet.icon,
        })
        console.debug(`[Bridge] Registered wallet: ${activeWallet.name}`)
        walletRegistered.current = true
        lastRegisteredWallet.current = activeWallet.uuid
      } catch (error) {
        console.warn(`[Bridge] Failed to register ${activeWallet.name}:`, error)
      }
    },
    [activeWallet]
  )

  // Setup widget event listeners
  const setupWidgetEvents = useCallback(
    (widget: DeBridgeWidget, force = false) => {
      // Listen for needConnect event to register active wallet
      widget.on("needConnect", () => {
        registerWalletWithWidget(widget, true) // Force registration on needConnect
      })

      // Also register wallet immediately in case needConnect was already fired
      registerWalletWithWidget(widget, force)
    },
    [registerWalletWithWidget]
  ) // Depend on the memoized function

  // Reset registration state when active wallet changes
  useEffect(() => {
    walletRegistered.current = false
    // Don't reset lastRegisteredWallet here to prevent unnecessary re-registrations
  }, [activeWallet])

  // Re-detect active wallet when accounts change
  const refreshActiveWallet = useCallback(async () => {
    if (detectedWallets.length > 0) {
      const active = await findActiveWallet(detectedWallets)
      // Only update if the active wallet actually changed
      if (active?.uuid !== activeWallet?.uuid) {
        console.debug(
          "[useBridgeWallets] Active wallet changed from",
          activeWallet?.name || "none",
          "to",
          active?.name || "none"
        )
        setActiveWallet(active)
      }
    }
  }, [detectedWallets, activeWallet])

  // Initial wallet detection
  useEffect(() => {
    detectWallets()
  }, [])

  // Listen for account changes to update active wallet
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null
    let lastRefreshTime = 0
    const MIN_REFRESH_INTERVAL = 2000 // Minimum 2 seconds between refreshes

    const debouncedRefresh = () => {
      const now = Date.now()
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return // Skip if too soon
      }

      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      refreshTimeout = setTimeout(() => {
        lastRefreshTime = Date.now()
        refreshActiveWallet()
      }, 1000) // Increased delay to 1 second
    }

    const handleAccountsChanged = (accounts: string[]) => {
      // Only refresh if there are actual accounts or if accounts were cleared
      if (accounts?.length > 0 || (activeWallet && accounts?.length === 0)) {
        console.debug(
          "[useBridgeWallets] Accounts changed, length:",
          accounts?.length || 0
        )
        debouncedRefresh()
      }
    }

    const handleConnect = () => {
      console.debug("[useBridgeWallets] Wallet connected")
      debouncedRefresh()
    }

    const handleDisconnect = () => {
      console.debug("[useBridgeWallets] Wallet disconnected")
      debouncedRefresh()
    }

    // Listen to account changes on all detected wallets
    detectedWallets.forEach((wallet) => {
      if (wallet.provider.on) {
        wallet.provider.on("accountsChanged", handleAccountsChanged)
        wallet.provider.on("connect", handleConnect)
        wallet.provider.on("disconnect", handleDisconnect)
      }
    })

    return () => {
      // Cleanup timeout
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }

      // Cleanup listeners
      detectedWallets.forEach((wallet) => {
        if (wallet.provider.removeListener) {
          wallet.provider.removeListener(
            "accountsChanged",
            handleAccountsChanged
          )
          wallet.provider.removeListener("connect", handleConnect)
          wallet.provider.removeListener("disconnect", handleDisconnect)
        }
      })
    }
  }, [detectedWallets, refreshActiveWallet])

  return {
    detectedWallets,
    activeWallet,
    isDetecting,
    detectWallets,
    refreshActiveWallet,
    setupWidgetEvents,
    registerWalletWithWidget,
  }
}

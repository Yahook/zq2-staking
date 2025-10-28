import { useEffect, useRef, useState } from "react"
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
  const registerWalletWithWidget = (widget: DeBridgeWidget, force = false) => {
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
  }

  // Setup widget event listeners
  const setupWidgetEvents = (widget: DeBridgeWidget, force = false) => {
    // Listen for needConnect event to register active wallet
    widget.on("needConnect", () => {
      registerWalletWithWidget(widget, true) // Force registration on needConnect
    })

    // Also register wallet immediately in case needConnect was already fired
    registerWalletWithWidget(widget, force)
  }

  // Reset registration state when active wallet changes
  useEffect(() => {
    walletRegistered.current = false
    // Don't reset lastRegisteredWallet here to prevent unnecessary re-registrations
  }, [activeWallet])

  // Re-detect active wallet when accounts change
  const refreshActiveWallet = async () => {
    if (detectedWallets.length > 0) {
      const active = await findActiveWallet(detectedWallets)
      // Only update if the active wallet actually changed
      if (active?.uuid !== activeWallet?.uuid) {
        setActiveWallet(active)
      }
    }
  }

  // Initial wallet detection
  useEffect(() => {
    detectWallets()
  }, [])

  // Listen for account changes to update active wallet
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null

    const debouncedRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      refreshTimeout = setTimeout(() => {
        refreshActiveWallet()
      }, 500) // Increased delay to prevent too frequent updates
    }

    const handleAccountsChanged = () => {
      debouncedRefresh()
    }

    const handleConnect = () => {
      debouncedRefresh()
    }

    const handleDisconnect = () => {
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

// EIP-6963 wallet detection utilities
export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: any
}

// Extend Window interface for EIP-6963 events
declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EIP6963ProviderDetail>
    "eip6963:requestProvider": Event
  }
}

export interface DetectedWallet {
  provider: any
  name: string
  icon: string
  rdns: string
  uuid: string
}

// EIP-6963 event listener for wallet detection
export function detectEIP6963Wallets(): Promise<DetectedWallet[]> {
  return new Promise((resolve) => {
    const wallets: DetectedWallet[] = []
    const timeout = 1000 // 1 second timeout

    const handleAnnouncement = (event: CustomEvent<EIP6963ProviderDetail>) => {
      const { info, provider } = event.detail

      // Avoid duplicates
      if (!wallets.find((w) => w.uuid === info.uuid)) {
        wallets.push({
          provider,
          name: info.name,
          icon: info.icon,
          rdns: info.rdns,
          uuid: info.uuid,
        })
      }
    }

    // Listen for EIP-6963 announcements
    window.addEventListener("eip6963:announceProvider", handleAnnouncement)

    // Request providers to announce themselves
    window.dispatchEvent(new Event("eip6963:requestProvider"))

    // Wait for announcements and then resolve
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", handleAnnouncement)
      resolve(wallets)
    }, timeout)
  })
}

// Legacy wallet detection (for wallets that don't support EIP-6963)
export function detectLegacyWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = []

  // Check for common wallet providers in window object
  const legacyWallets = [
    {
      key: "ethereum",
      name: "MetaMask",
      icon: "https://app.debridge.com/assets/images/dln-details/wallet/metamask.svg",
      rdns: "io.metamask",
    },
    {
      key: "zilPay",
      name: "ZilPay",
      icon: "https://zilpay.io/favicon.ico",
      rdns: "io.zilpay",
    },
    {
      key: "phantom",
      name: "Phantom",
      icon: "https://app.debridge.com/assets/images/dln-details/wallet/phenom.svg",
      rdns: "app.phantom",
      path: "phantom.ethereum", // Phantom EVM provider
    },
    {
      key: "coinbaseWallet",
      name: "Coinbase Wallet",
      icon: "https://app.debridge.com/assets/images/dln-details/wallet/coinbase.svg",
      rdns: "com.coinbase.wallet",
    },
    {
      key: "trustWallet",
      name: "Trust Wallet",
      icon: "https://app.debridge.com/assets/images/dln-details/wallet/trust.svg",
      rdns: "com.trustwallet.app",
    },
  ]

  legacyWallets.forEach((wallet) => {
    try {
      const provider = wallet.path
        ? getNestedProperty(window, wallet.path)
        : (window as any)[wallet.key]

      if (provider && typeof provider === "object") {
        // Check if it's a valid Ethereum provider
        if (
          provider.isMetaMask !== undefined ||
          provider.request ||
          provider.send ||
          provider.sendAsync
        ) {
          wallets.push({
            provider,
            name: wallet.name,
            icon: wallet.icon,
            rdns: wallet.rdns,
            uuid: `legacy-${wallet.key}`,
          })
        }
      }
    } catch (error) {
      console.debug(`Failed to detect ${wallet.name}:`, error)
    }
  })

  return wallets
}

// Helper function to get nested properties from window object
function getNestedProperty(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

// Main function to detect all available wallets
export async function detectAllWallets(): Promise<DetectedWallet[]> {
  if (typeof window === "undefined") {
    return []
  }

  try {
    // First try EIP-6963 detection
    const eip6963Wallets = await detectEIP6963Wallets()

    // Then try legacy detection
    const legacyWallets = detectLegacyWallets()

    // Combine and deduplicate
    const allWallets = [...eip6963Wallets]

    // Add legacy wallets that weren't found via EIP-6963
    legacyWallets.forEach((legacyWallet) => {
      const exists = eip6963Wallets.find(
        (w) => w.rdns === legacyWallet.rdns || w.name === legacyWallet.name
      )
      if (!exists) {
        allWallets.push(legacyWallet)
      }
    })

    console.debug(
      `[WalletDetection] Found ${allWallets.length} wallets:`,
      allWallets.map((w) => w.name)
    )

    return allWallets
  } catch (error) {
    console.error("[WalletDetection] Error detecting wallets:", error)
    return []
  }
}

// Check if a provider supports EVM
export function isEVMProvider(provider: any): boolean {
  if (!provider || typeof provider !== "object") {
    return false
  }

  // Check for standard Ethereum provider methods
  return !!(
    provider.request ||
    provider.send ||
    provider.sendAsync ||
    provider.isMetaMask !== undefined ||
    provider.isConnected
  )
}

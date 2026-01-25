import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import {
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets"
import { createClient, createPublicClient, defineChain, http } from "viem"
import { createConfig } from "wagmi"
import { zilPayWallet } from "./zilPayWallet"

export const CHAIN_ZQ2_DEVNET = defineChain({
  id: 33469,
  name: "Zq2 Devnet",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.zq2-devnet.zilliqa.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://explorer.zq2-devnet.zilliqa.com",
    },
  },
})

export const CHAIN_ZQ2_PROTOTESTNET = defineChain({
  id: 33103,
  name: "Zq2 ProtoTestnet",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.zq2-prototestnet.zilliqa.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://explorer.zq2-prototestnet.zilliqa.com",
    },
  },
})

export const CHAIN_ZQ2_PROTOMAINNET = defineChain({
  id: 32770,
  name: "Zq2 ProtoMainnet",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.zq2-protomainnet.zilliqa.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://explorer.zq2-protomainnet.zilliqa.com",
    },
  },
})

export const CHAIN_ZQ2_DOCKERCOMPOSE = defineChain({
  id: 87362,
  name: "Zq2 Dockercompose",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["http://localhost:4201"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "http://localhost:5100/",
    },
  },
})

export const MOCK_CHAIN = defineChain({
  id: 9999999,
  name: "Mock Chain",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["NOT_USED"],
    },
  },
  blockExplorers: {
    default: {
      name: "NOT_USED",
      url: "NOT_USED",
    },
  },
})

export const CHAIN_MAINNET = defineChain({
  id: 32769,
  name: "Zilliqa Mainnet",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://ssn.zilpay.io/api"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://otterscan.zilliqa.com",
    },
  },
})

function getConnectorsForWallets(walletConnectApiKey: string, appUrl: string) {
  const projectId = walletConnectApiKey

  return connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [
          zilPayWallet,
          metaMaskWallet,
          walletConnectWallet,
          coinbaseWallet,
          rabbyWallet,
          trustWallet,
          ledgerWallet,
          rainbowWallet,
          phantomWallet,
        ],
      },
    ],
    {
      appName: "ZQ2 Staking",
      projectId: projectId,
      appUrl,
    }
  )
}

export function getChain(chainId: number) {
  const chain = [
    CHAIN_ZQ2_DEVNET,
    CHAIN_ZQ2_PROTOTESTNET,
    CHAIN_ZQ2_PROTOMAINNET,
    CHAIN_ZQ2_DOCKERCOMPOSE,
    CHAIN_MAINNET,
    MOCK_CHAIN,
  ].find((chain) => chain.id === chainId)

  if (!chain) {
    throw new Error(`Active chain [${chainId}] is not defined`)
  }

  return chain
}

let wagmiConfig: ReturnType<typeof createConfig> | null = null

export function getWagmiConfig(
  chainId: number,
  walletConnectApiKey: string,
  appUrl: string
) {
  if (!wagmiConfig) {
    wagmiConfig = createConfig({
      chains: [getChain(chainId)],
      client({ chain }) {
        return createClient({ chain, transport: http() })
      },
      connectors: getConnectorsForWallets(walletConnectApiKey, appUrl),
      ssr: true,
    })
  }

  return wagmiConfig
}

export function getViemClient(chainId: number) {
  return createPublicClient({
    chain: getChain(chainId),
    transport: http(),
  })
}

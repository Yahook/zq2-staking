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
import {
  createClient,
  createPublicClient,
  createTransport,
  defineChain,
  fallback,
  http,
  type Transport,
} from "viem"
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
      http: ["https://api.zilliqa.com", "https://ssn.zilpay.io/api"],
    },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://otterscan.zilliqa.com",
    },
  },
})

/**
 * A node whose head trails the freshest node by more than this many blocks
 * (~1.1s per block) is treated as stuck and pushed to the end of the list.
 */
const MAX_BLOCK_LAG = 60n
const NODE_ORDER_TTL_MS = 30_000
const HEAD_PROBE_TIMEOUT_MS = 3_000

interface NodeOrderEntry {
  order: string[]
  checkedAt: number
  pending: Promise<string[]> | null
}

// Shared by every client built from the same URL list, so the many
// short-lived clients from getViemClient() don't each re-probe the nodes.
const nodeOrderCache = new Map<string, NodeOrderEntry>()

async function probeHeadBlock(url: string): Promise<bigint | null> {
  try {
    const { request } = http(url, {
      retryCount: 0,
      timeout: HEAD_PROBE_TIMEOUT_MS,
    })({})
    return BigInt((await request({ method: "eth_blockNumber" })) as string)
  } catch {
    return null
  }
}

/**
 * Orders nodes so that the ones in sync with the chain head come first.
 * Configured priority is kept inside each group. A stuck node keeps answering
 * with old state instead of erroring, so plain `fallback` never leaves it.
 */
async function rankNodesByFreshness(urls: string[]): Promise<string[]> {
  const heads = await Promise.all(urls.map(probeHeadBlock))
  const known = heads.filter((head): head is bigint => head !== null)
  if (known.length === 0) return urls

  const best = known.reduce((a, b) => (a > b ? a : b))
  const isFresh = (i: number) =>
    heads[i] !== null && best - heads[i]! <= MAX_BLOCK_LAG

  const fresh = urls.filter((_, i) => isFresh(i))
  const lagging = urls.filter((_, i) => !isFresh(i))
  if (lagging.length > 0) {
    console.warn(
      "RPC nodes behind chain head, demoted:",
      lagging.map((url) => `${url} @ ${heads[urls.indexOf(url)] ?? "down"}`),
      `head ${best}`
    )
  }
  return [...fresh, ...lagging]
}

async function getNodeOrder(urls: string[]): Promise<string[]> {
  const key = urls.join(",")
  let entry = nodeOrderCache.get(key)

  if (!entry) {
    entry = { order: urls, checkedAt: 0, pending: null }
    nodeOrderCache.set(key, entry)
  }

  const isExpired = Date.now() - entry.checkedAt > NODE_ORDER_TTL_MS
  if (isExpired && !entry.pending) {
    const current = entry
    current.pending = rankNodesByFreshness(urls)
      .then((order) => {
        current.order = order
        current.checkedAt = Date.now()
        return order
      })
      .finally(() => {
        current.pending = null
      })
  }

  // The first ranking is awaited; later refreshes run in the background
  // while requests keep using the last known order.
  if (entry.checkedAt === 0 && entry.pending) return entry.pending
  return entry.order
}

/**
 * Build a viem transport from a chain's `rpcUrls.default.http` list.
 * The first URL is the primary node; the rest act as fallbacks. On top of
 * viem's error-based `fallback`, nodes are re-ranked by chain head every
 * NODE_ORDER_TTL_MS, so a node that is up but stuck on an old block is
 * skipped. A single-URL list is a plain `http()` transport.
 */
function getTransport(chain: ReturnType<typeof defineChain>): Transport {
  const urls = [...chain.rpcUrls.default.http]
  if (urls.length < 2) return http(urls[0])

  return (params) => {
    const fallbackByOrder = new Map<string, ReturnType<Transport>>()
    const fallbackFor = (order: string[]) => {
      const key = order.join(",")
      let transport = fallbackByOrder.get(key)
      if (!transport) {
        transport = fallback(order.map((url) => http(url)))(params)
        fallbackByOrder.set(key, transport)
      }
      return transport
    }

    return createTransport({
      key: "freshestFallback",
      name: "Freshest-node fallback",
      type: "freshestFallback",
      // retries already happen inside the wrapped http/fallback transports
      retryCount: 0,
      // same `any` escape hatch viem's own fallback() uses for its generic request
      async request({ method, params }): Promise<any> {
        const order = await getNodeOrder(urls)
        return fallbackFor(order).request({ method, params })
      },
    })
  }
}

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
        return createClient({ chain, transport: getTransport(chain) })
      },
      connectors: getConnectorsForWallets(walletConnectApiKey, appUrl),
      ssr: true,
    })
  }

  return wagmiConfig
}

export function getViemClient(chainId: number) {
  const chain = getChain(chainId)
  return createPublicClient({
    chain,
    transport: getTransport(chain),
  })
}

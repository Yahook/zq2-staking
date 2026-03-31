import {
  createPublicClient,
  http,
  erc20Abi,
  getAddress,
  type Address,
} from "viem"
import Big from "big.js"

const ZIL_EVM_RPC = "https://ssn.zilpay.io/api" as const

const STAKING_MIN_ZIL = 20_000

const ELIGIBILITY_POOLS = [
  {
    name: "Amazing Pool",
    proxy: "0x1f0e86Bc299Cc66df2e5512a7786C3F528C0b5b6",
  },
  {
    name: "2ZilMoon",
    proxy: "0xCDb0B23Db1439b28689844FD093C478d73C0786A",
  },
] as const

const CHAIN = {
  ZIL_EVM: 32769,
} as const

Big.DP = 40
Big.RM = 0

const client = createPublicClient({
  chain: {
    id: CHAIN.ZIL_EVM,
    name: "Zilliqa EVM",
    nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
    rpcUrls: { default: { http: [ZIL_EVM_RPC] } },
  },
  transport: http(ZIL_EVM_RPC),
})

const pow10 = (n: number) => Big(10).pow(n)

const fromUnits = (wei: bigint, decimals = 18): Big =>
  Big(wei.toString()).div(pow10(decimals))

const toDisplay = (x: Big, dp = 6): number => Number(x.toFixed(dp))

const ABI_LIQ = [
  {
    type: "function",
    name: "getLST",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "lst",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

const ABI_NONLIQ_GET_DELEGATED = [
  {
    type: "function",
    name: "getDelegatedAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const

const ABI_NONLIQ_STAKED_OF = [
  {
    type: "function",
    name: "stakedOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const

async function readAmazingStakeBig(
  user: Address,
  proxy: Address
): Promise<Big> {
  const lst =
    (await (client as any)
      .readContract({
        address: proxy,
        abi: ABI_LIQ as any,
        functionName: "getLST",
      })
      .catch(() => null)) ??
    (await (client as any)
      .readContract({
        address: proxy,
        abi: ABI_LIQ as any,
        functionName: "lst",
      })
      .catch(() => null))

  if (!lst || lst === "0x0000000000000000000000000000000000000000") {
    return Big(0)
  }

  const [priceRaw, balRaw, decRaw] = await Promise.all([
    (client as any).readContract({
      address: proxy,
      abi: ABI_LIQ as any,
      functionName: "getPrice",
    }) as Promise<bigint>,
    (client as any).readContract({
      address: lst as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [user],
    }) as Promise<bigint>,
    (client as any)
      .readContract({
        address: lst as Address,
        abi: erc20Abi,
        functionName: "decimals",
      })
      .catch(() => 18) as Promise<number>,
  ])

  const price = fromUnits(priceRaw, 18)
  const balLST = fromUnits(balRaw, Number(decRaw ?? 18))

  return balLST.times(price)
}

async function readZilMoonStakeBig(
  user: Address,
  proxy: Address
): Promise<Big> {
  const val = await (client as any)
    .readContract({
      address: proxy,
      abi: ABI_NONLIQ_GET_DELEGATED as any,
      functionName: "getDelegatedAmount",
      account: user,
    })
    .catch(async () => {
      return (client as any)
        .readContract({
          address: proxy,
          abi: ABI_NONLIQ_STAKED_OF as any,
          functionName: "stakedOf",
          args: [user],
        })
        .catch(() => 0n)
    })

  return fromUnits(val as bigint, 18)
}

export type PoolStake = { pool: string; proxy: Address; stakedZil: number }

export async function getStakedZilForAddress(
  user: Address
): Promise<{ total: number; perPool: PoolStake[]; chainId: number }> {
  const u = getAddress(user)
  const chainId = Number(await (client as any).getChainId())

  const amazing = ELIGIBILITY_POOLS.find((p) => /amazing/i.test(p.name))!
  const zilmoon = ELIGIBILITY_POOLS.find((p) => /zilmoon/i.test(p.name))!

  const [bAmazing, bZilmoon] = await Promise.all([
    readAmazingStakeBig(u, getAddress(amazing.proxy as Address)),
    readZilMoonStakeBig(u, getAddress(zilmoon.proxy as Address)),
  ])

  const totalBig = bAmazing.plus(bZilmoon)

  const perPool: PoolStake[] = [
    {
      pool: amazing.name,
      proxy: getAddress(amazing.proxy as Address),
      stakedZil: toDisplay(bAmazing),
    },
    {
      pool: zilmoon.name,
      proxy: getAddress(zilmoon.proxy as Address),
      stakedZil: toDisplay(bZilmoon),
    },
  ]

  return { total: toDisplay(totalBig), perPool, chainId }
}

export async function isEligibleForZeroFee(
  user: Address
): Promise<{ eligible: boolean; total: number }> {
  const u = getAddress(user)
  const amazing = ELIGIBILITY_POOLS.find((p) => /amazing/i.test(p.name))!
  const zilmoon = ELIGIBILITY_POOLS.find((p) => /zilmoon/i.test(p.name))!

  const [bAmazing, bZilmoon] = await Promise.all([
    readAmazingStakeBig(u, getAddress(amazing.proxy as Address)),
    readZilMoonStakeBig(u, getAddress(zilmoon.proxy as Address)),
  ])

  const total = bAmazing.plus(bZilmoon)
  const threshold = Big(STAKING_MIN_ZIL)

  return {
    eligible: total.gte(threshold),
    total: toDisplay(total),
  }
}

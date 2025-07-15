import {
  Address,
  ContractFunctionArgs,
  ContractFunctionName,
  erc20Abi,
  formatUnits,
  parseUnits,
  ReadContractReturnType,
} from "viem"
import {
  CHAIN_ZQ2_PROTOTESTNET,
  getViemClient,
  MOCK_CHAIN,
  CHAIN_ZQ2_DEVNET,
  CHAIN_ZQ2_PROTOMAINNET,
  CHAIN_MAINNET,
} from "./chainConfig"
import { readContract } from "viem/actions"
import {
  depositAbi,
  liquidDelegatorAbi,
  nonLiquidDelegatorAbi,
} from "./stakingAbis"

/**
 * Deposit address is always the same
 */
const DEPOSIT_ADDRESS = "0x00000000005a494c4445504f53495450524f5859" as Address

export enum StakingPoolType {
  LIQUID = "LIQUID",
  NORMAL = "NON_LIQUID",
}

export interface StakingPoolDefinition {
  id: string
  name: string
  poolType: StakingPoolType
  address: string
  tokenAddress: string
  tokenDecimals: number
  tokenSymbol: string
  iconUrl: string
  minimumStake: bigint
  withdrawPeriodInMinutes: number
  description?: string
}

export interface StakingPoolData {
  tvl: bigint
  apr: number
  commission: number
  votingPower: number
  zilToTokenRate: number
}

export interface StakingPool {
  definition: StakingPoolDefinition
  data: StakingPoolData | null
}

export interface StakingPoolConfig {
  definition: StakingPoolDefinition
  delegatorDataProvider: (
    definition: StakingPoolDefinition,
    chainId: number
  ) => Promise<StakingPoolData>
}

async function mockDelegatorDataProvider(
  mockData: StakingPoolData,
  loadingMiliseconds: number
): Promise<StakingPoolData> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockData)
    }, loadingMiliseconds)
  })
}

async function fetchLiquidDelegatorDataFromNetwork(
  definition: StakingPoolDefinition,
  chainId: number
): Promise<StakingPoolData> {
  const viemClient = getViemClient(chainId)

  const readDelegatorContract = async <
    functionName extends ContractFunctionName<
      typeof liquidDelegatorAbi,
      "pure" | "view"
    >,
    const args extends ContractFunctionArgs<
      typeof liquidDelegatorAbi,
      "pure" | "view",
      functionName
    >,
  >(
    fname: functionName
  ): Promise<
    ReadContractReturnType<typeof liquidDelegatorAbi, functionName, args>
  > => {
    return readContract(viemClient, {
      address: definition.address as Address,
      abi: liquidDelegatorAbi,
      functionName: fname,
    })
  }

  try {
    const [
      totalSupply,
      zilToTokenRateWei,
      delegatorStake,
      depositTotalStake,
      [commissionNumerator, commissionDenominator],
    ] = await Promise.all([
      readContract(viemClient, {
        address: definition.tokenAddress as Address,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
      readDelegatorContract("getPrice"),
      readDelegatorContract("getStake"),
      readContract(viemClient, {
        address: DEPOSIT_ADDRESS,
        abi: depositAbi,
        functionName: "getFutureTotalStake",
      }),
      readDelegatorContract("getCommission"),
    ])

    const zilToTokenRate = 1 / parseFloat(formatUnits(zilToTokenRateWei, 18))

    const bigintDivisionPrecision = 1000000n

    const commission =
      Number(
        (commissionNumerator * bigintDivisionPrecision) / commissionDenominator
      ) / Number(bigintDivisionPrecision)
    const votingPower =
      Number((delegatorStake * bigintDivisionPrecision) / depositTotalStake) /
      Number(bigintDivisionPrecision)
    const rewardsPerYearInZil = 51000 * 24 * 365

    const delegatorYearReward = votingPower * rewardsPerYearInZil
    const delegatorRewardForShare = delegatorYearReward * (1 - commission)
    const apr =
      delegatorRewardForShare / parseFloat(formatUnits(delegatorStake, 18))

    return {
      tvl: totalSupply,
      commission,
      zilToTokenRate,
      votingPower,
      apr: apr,
    }
  } catch (error) {
    console.error("Error fetching total supply:", error)
    throw error
  }
}

async function fetchNonLiquidDelegatorDataFromNetwork(
  definition: StakingPoolDefinition,
  chainId: number
): Promise<StakingPoolData> {
  const viemClient = getViemClient(chainId)

  const readDelegatorContract = async <
    functionName extends ContractFunctionName<
      typeof nonLiquidDelegatorAbi,
      "pure" | "view"
    >,
    const args extends ContractFunctionArgs<
      typeof nonLiquidDelegatorAbi,
      "pure" | "view",
      functionName
    >,
  >(
    fname: functionName
  ): Promise<
    ReadContractReturnType<typeof nonLiquidDelegatorAbi, functionName, args>
  > => {
    return readContract(viemClient, {
      address: definition.address as Address,
      abi: nonLiquidDelegatorAbi,
      functionName: fname,
    })
  }

  try {
    const [
      tvl,
      delegatorStake,
      depositTotalStake,
      [commissionNumerator, commissionDenominator],
    ] = await Promise.all([
      readDelegatorContract("getDelegatedTotal"),
      readDelegatorContract("getStake"),
      readContract(viemClient, {
        address: DEPOSIT_ADDRESS,
        abi: depositAbi,
        functionName: "getFutureTotalStake",
      }),
      readDelegatorContract("getCommission"),
    ])

    const bigintDivisionPrecision = 1000000n

    const commission =
      Number(
        (commissionNumerator * bigintDivisionPrecision) / commissionDenominator
      ) / Number(bigintDivisionPrecision)
    const votingPower =
      Number((delegatorStake * bigintDivisionPrecision) / depositTotalStake) /
      Number(bigintDivisionPrecision)
    const rewardsPerYearInZil = 51000 * 24 * 365

    const delegatorYearReward = votingPower * rewardsPerYearInZil
    const delegatorRewardForShare = delegatorYearReward * (1 - commission)
    const apr =
      delegatorRewardForShare / parseFloat(formatUnits(delegatorStake, 18))

    return {
      tvl,
      commission,
      zilToTokenRate: 1,
      votingPower,
      apr: apr,
    }
  } catch (error) {
    console.error("Error fetching total supply:", error)
    throw error
  }
}

const twoWeeksInMinutes = 60 * 24 * 14
const fiveMinutesInMinutes = 5

export const stakingPoolsConfigForChainId: Record<
  string,
  Array<StakingPoolConfig>
> = {
  [MOCK_CHAIN.id]: [
    {
      definition: {
        id: "pool1",
        name: "Avely",
        description:
          "🌟 Avely was the first liquid staking on Zilliqa!\nWe built the most advanced smart contracts and put our 💙 and expertise into every line of code.\nBy supporting us, you’re not just staking — you’re empowering us to keep building and make Zilliqa stronger than ever.\nJoin us and stake with confidence!",
        poolType: StakingPoolType.LIQUID,
        address: "0x1234567890234567890234567890234567890",
        tokenAddress: "0x1234567890234567890234567890234567233",
        tokenDecimals: 18,
        tokenSymbol: "avZIL",
        iconUrl: "/static/logo2.webp",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: mockDelegatorDataProvider.bind(
        null,
        {
          tvl: parseUnits("3621786", 18),
          apr: 0.135,
          commission: 0.1,
          votingPower: 0.3,
          zilToTokenRate: 0.156374848922222,
        },
        2000
      ),
    },
    {
      definition: {
        id: "pool2",
        name: "Plunderswap",
        description:
          "We pay extra. The only validator with airdrops + reward points. Your stake powers Zilliqa's top dev team. [Stake smarter!](https://stake.plunderswap.com/)",
        poolType: StakingPoolType.LIQUID,
        address: "0x82245678902345678902345678918278372382",
        tokenAddress: "0x1234567890234567890234567890234567231",
        tokenDecimals: 18,
        tokenSymbol: "plZIL",
        iconUrl: "/static/logo1.webp",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: mockDelegatorDataProvider.bind(
        null,
        {
          tvl: parseUnits("0", 18),
          apr: 0.21,
          commission: 0.011,
          votingPower: 0.5,
          zilToTokenRate: 0.7723232322,
        },
        1000
      ),
    },
    {
      definition: {
        id: "pool3",
        name: "IgniteDao",
        poolType: StakingPoolType.LIQUID,
        address: "0x96525678902345678902345678918278372212",
        tokenAddress: "0x1234567890234567890234567890234567232",
        tokenDecimals: 18,
        tokenSymbol: "igZIL",
        iconUrl: "/static/logo3.webp",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: mockDelegatorDataProvider.bind(
        null,
        {
          tvl: parseUnits("98173829", 18),
          apr: 1.1,
          commission: 0.05,
          votingPower: 0.2,
          zilToTokenRate: 0.9392382873,
        },
        5000
      ),
    },
    {
      definition: {
        id: "pool4",
        name: "ADAMine",
        poolType: StakingPoolType.LIQUID,
        address: "0x965256789023456789023456789182783K92Uh",
        tokenAddress: "0x1234567890234567890234567890234567234",
        tokenDecimals: 18,
        tokenSymbol: "adaZIL",
        iconUrl: "/static/logo5.webp",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: mockDelegatorDataProvider.bind(
        null,
        {
          tvl: parseUnits("100", 18),
          apr: 0.13,
          commission: 0.01,
          votingPower: 0.01,
          zilToTokenRate: 1.5,
        },
        500
      ),
    },
    {
      definition: {
        id: "K23k2322",
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/quantum.webp",
        name: "Quantum",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: mockDelegatorDataProvider.bind(
        null,
        {
          tvl: parseUnits("100000", 18),
          apr: 0.13,
          commission: 0.01,
          votingPower: 0.05,
          zilToTokenRate: 0.111112323232313,
        },
        100
      ),
    },
  ],
  [CHAIN_ZQ2_PROTOTESTNET.id]: [
    {
      definition: {
        id: "MHg3QTI4",
        address: "0x7A28eda6899d816e574f7dFB62Cc8A84A4fF92a6",
        tokenAddress: "0x3fE49722fC4F9F119AB18fE0CF7D340A23C8388b",
        iconUrl: "/static/logo2.webp",
        name: "Validator 1",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "LST1",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg2MmYz",
        address: "0x62f3FC68ba2Ff62b23E73c48010262aD64054032",
        tokenAddress: "0x7854BFB32CC7a377165Ee3B5C8103a80A07913B2",
        iconUrl: "/static/logo1.webp",
        name: "Validator 2",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "LST2",
        minimumStake: parseUnits("100", 18),
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
  ],
  [CHAIN_ZQ2_DEVNET.id]: [
    {
      definition: {
        id: "MHg3YTBi",
        address: "0x7a0b7e6d24ede78260c9ddbd98e828b0e11a8ea2",
        tokenAddress: "0x9e5c257D1c6dF74EaA54e58CdccaCb924669dc83",
        iconUrl: "/static/collective.webp",
        name: "Collective",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "xZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: fiveMinutesInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg3ZTAy",
        address: "0x7e02c204daf4e1140a331d6dfad1eeb265d9544f",
        tokenAddress: "0xDbdb7f1f01c438f9951d780Ac9C42E9795Bb938f",
        iconUrl: "/static/quantum.webp",
        name: "Quantum",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "yZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: fiveMinutesInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg1OTZh",
        address: "0x983fC5214be8fB08A205902ea73A2cA10811060c",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/citadel.webp",
        name: "Citadel",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: fiveMinutesInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
  ],
  [CHAIN_ZQ2_PROTOMAINNET.id]: [
    {
      definition: {
        id: "MHhBMDU3",
        address: "0xA0572935d53e14C73eBb3de58d319A9Fe51E1FC8",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_moonlet.webp",
        name: "Moonlet",
        description:
          "Moonlet is a trusted validator offering secure, high-performance staking for top proof-of-stake networks.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgyQWJl",
        address: "0x2Abed3a598CBDd8BB9089c09A9202FD80C55Df8c",
        tokenAddress: "0xD8B61fed51b9037A31C2Bf0a5dA4B717AF0C0F78",
        iconUrl: "/static/logo_AtomicWallet.webp",
        name: "AtomicWallet",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "SHARK",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhCOWQ2",
        address: "0xB9d689c64b969ad9eDd1EDDb50be42E217567fd3",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_cex.webp",
        name: "CEX.IO",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhlMEMw",
        address: "0xe0C095DBE85a8ca75de4749B5AEe0D18100a3C39",
        tokenAddress: "0x7B213b5AEB896bC290F0cD8B8720eaF427098186",
        iconUrl: "/static/logo_Plunderswap.webp",
        name: "PlunderSwap",
        description:
          "We pay extra. The only validator with airdrops + reward points. Your stake powers Zilliqa's top dev team. [Stake smarter!](https://stake.plunderswap.com/)",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "pZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhDMDI0",
        address: "0xC0247d13323F1D06b6f24350Eea03c5e0Fbf65ed",
        tokenAddress: "0x2c51C97b22E73AfD33911397A20Aa5176e7Ab951",
        iconUrl: "/static/logo_Luganodes.webp",
        name: "Luganodes",
        description:
          "Swiss-Operated, Non-Custodial, Institutional Grade Staking Provider with $3Bn+ in Assets, Supporting 50+ PoS Networks.",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "LNZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg4QTBk",
        address: "0x8A0dEd57ABd3bc50A600c94aCbEcEf62db5f4D32",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_Dteam.webp",
        name: "DTEAM",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgzYjFD",
        address: "0x3b1Cd55f995a9A8A634fc1A3cEB101e2baA636fc",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_shardpool.svg",
        name: "Shardpool",
        description:
          "Stake with Shardpool, a trusted Zilliqa validator delivering top-tier uptime, secure infrastructure, and consistent rewards. Backed by years of node-running expertise—you earn more, worry less.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg2NmEy",
        address: "0x66a2bb4AD6999966616B2ad209833260F8eA07C8",
        tokenAddress: "0xA1Adc08C12c684AdB28B963f251d6cB1C6a9c0c1",
        iconUrl: "/static/logo_encapsulate.webp",
        name: "Encapsulate",
        description:
          "Others Trust, We Validate! Your Stake is Important to Us. Help us secure Zilliqa Network while You Earn Rewards",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "encapZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhlNTlE",
        address: "0xe59D98b887e6D40F52f7Cc8d5fb4CF0F9Ed7C98B",
        tokenAddress: "0xf564DF9BeB417FB50b38A58334CA7607B36D3BFb",
        iconUrl: "/static/logo_stzill.webp",
        name: "Amazing Pool - Avely and ZilPay",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "stZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhkMDkw",
        address: "0xd090424684a9108229b830437b490363eB250A58",
        tokenAddress: "0xE10575244f8E8735d71ed00287e9d1403f03C960",
        iconUrl: "/static/logo_pathrocknetwork.webp",
        name: "PathrockNetwork",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "zLST",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgzM2NE",
        address: "0x33cDb55D7fD68d0Da1a3448F11bCdA5fDE3426B3",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_blacknodes.webp",
        name: "BlackNodes",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgzNTEx",
        address: "0x35118Af4Fc43Ce58CEcBC6Eeb21D0C1Eb7E28Bd3",
        tokenAddress: "0x245E6AB0d092672B18F27025385f98E2EC3a3275",
        iconUrl: "/static/logo_lithiumdigital.webp",
        name: "Lithium Digital",
        description:
          "Institutional Grade Security and User-Level Simplicity. Lithium Digital is Reliability You Can Stake On.",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "litZil",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg2MjI2",
        address: "0x62269F615E1a3E36f96dcB7fDDF8B823737DD618",
        tokenAddress: "0x770a35A5A95c2107860E9F74c1845e20289cbfe6",
        iconUrl: "/static/logo_torchwallet.webp",
        name: "TorchWallet.io",
        description:
          "By using Torch, you stay eligible for potential airdrops & rewards in the Zilliqa ecosystem. Torch is the most advanced and widely used mobile and desktop wallet for Zilliqa, offering a smooth experience for staking, instant unstaking, DEX swapping, and full support for both Legacy & EVM accounts. If you stake here on the portal, it will automatically appear in the app. [Try it out now!](https://torchwallet.io/)",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "tZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhhNDUx",
        address: "0xa45114E92E26B978F0B37cF19E66634f997250f9",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_stakefish.webp",
        name: "Stakefish",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgwMjM3",
        address: "0x02376bA9e0f98439eA9F76A582FBb5d20E298177",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_alphazil.svg",
        name: "AlphaZIL (former Ezil)",
        description:
          "You trusted us with your hashrate - now trust us with your stake.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
  ],
  [CHAIN_MAINNET.id]: [
    {
      definition: {
        id: "MHg2OTE2",
        address: "0x691682FCa60Fa6B702a0a69F60d045c08f404220",
        tokenAddress: "0xc85b0db68467dede96A7087F4d4C47731555cA7A",
        iconUrl: "/static/logo_Plunderswap.webp",
        name: "PlunderSwap",
        description: "A forked version of PancakeSwap.",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "pZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgxMzEx",
        address: "0x1311059DD836D7000Dc673eA4Cc834fe04e9933C",
        tokenAddress: "0x8E3073b22F670d3A09C66D0Abb863f9E358402d2",
        iconUrl: "/static/logo_encapsulate.webp",
        name: "Encapsulate",
        description:
          "Others Trust, We Validate! Your Stake is Important to Us. Help us secure Zilliqa Network while You Earn Rewards",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "encapZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgxODky",
        address: "0x18925cE668b2bBC26dfE6F630F5C285D46b937AE",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_cex.webp",
        name: "CEX.IO",
        description:
          "[CEX.IO](https://cex.io) is an entire ecosystem of products and services that allow customers to engage with the decentralized economy",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg4QTBk",
        address: "0x8776F1135b3583DbaE79C8f7268a7e0d4C16462c",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_Dteam.webp",
        name: "DTEAM",
        description:
          "[dteam.tech](https://dteam.tech) provides reliable infrastructure to support and scale projects effectively, along with building essential tools tailored for project communities, node operators and developers.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhDMDI0",
        address: "0x63CE81C023Bb9F8A6FFA08fcF48ba885C21FcFBC",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_Luganodes.webp",
        name: "Luganodes",
        description:
          "Swiss-Operated, Non-Custodial, Institutional Grade Staking Provider with $3Bn+ in Assets, Supporting 50+ PoS Networks.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg2M0NF",
        address: "0x715F94264057df97e772ebDFE2c94A356244F142",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_stakefish.webp",
        name: "Stakefish",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhCQjJD",
        address: "0xBB2Cb8B573Ec1ec4f77953128df7F1d08D9c34DF",
        tokenAddress: "0x9e4E0F7A06E50DA13c78cF8C83E907f792DE54fd",
        iconUrl: "/static/logo_torchwallet.webp",
        name: "TorchWallet.io",
        description:
          "By using Torch, you stay eligible for potential airdrops & rewards in the Zilliqa ecosystem. Torch is the most advanced and widely used mobile and desktop wallet for Zilliqa, offering a smooth experience for staking, instant unstaking, DEX swapping, and full support for both Legacy & EVM accounts. If you stake here on the portal, it will automatically appear in the app. [Try it out now!](https://torchwallet.io/)",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "tZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhCRDZj",
        address: "0xBD6ca237f30A86eea8CF9bF869677F3a0496a990",
        tokenAddress: "0x3B78f66651E2eCAbf13977817848F82927a17DcF",
        iconUrl: "/static/logo_lithiumdigital.webp",
        name: "Lithium Digital",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "litZil",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhGMzVF",
        address: "0xF35E17333Bd4AD7b11e18f750AFbccE14e4101b7",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_moonlet.webp",
        name: "Moonlet",
        description:
          "Moonlet is a trusted validator offering secure, high-performance staking for top proof-of-stake networks.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg4NzI5",
        address: "0x87297b0B63A0b93D3f7cAFA9E0f4C849e92642EB",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_blacknodes.png",
        name: "BlackNodes",
        description: "Democratization Through Decentralization",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgwNjhD",
        address: "0x068C599686d2511AD709B8b4C578549A65D19491",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_ezil.svg",
        name: "AlphaZIL (former Ezil)",
        description:
          "You trusted us with your hashrate - now trust us with your stake.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgzYjFD",
        address: "0xE5e8158883A37449Ae07fe70B69E658766B317fc",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_shardpool.svg",
        name: "Shardpool",
        description:
          "Stake with Shardpool, a trusted Zilliqa validator delivering top-tier uptime, secure infrastructure, and consistent rewards. Backed by years of node-running expertise—you earn more, worry less.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg3RTNB",
        address: "0x7E3A0AEbBF8EC2F12a8a885CD663EE4a490F923f",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_zillet.svg",
        name: "Zillet Staking Pool",
        description:
          "Zillet provides stable, secure staking and has operated a Zilliqa validator node for over five years.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHgxZjBl",
        address: "0x1f0e86Bc299Cc66df2e5512a7786C3F528C0b5b6",
        tokenAddress: "0x8a2afD8Fe79F8C694210eB71f4d726Fc8cAFdB31",
        description:
          "🌟 Avely was the first liquid staking on Zilliqa!\nWe built the most advanced smart contracts and put our 💙 and expertise into every line of code.\nBy supporting us, you’re not just staking — you’re empowering us to keep building and make Zilliqa stronger than ever.\nJoin us and stake with confidence!",
        iconUrl: "/static/logo_amazing_pool.svg",
        name: "Amazing Pool - Avely and ZilPay",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "aZIL",
        minimumStake: 10000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhGN0Y0",
        address: "0xF7F4049e7472fC32805Aae5bcCE909419a34D254",
        tokenAddress: "0x737EBf814D2C14fb21E00Fd2990AFc364C2AF506",
        iconUrl: "/static/logo_shark.png",
        name: "Stake Shark",
        description:
          "Industry Leader. Trusted by 200,000 delegators since 2019. Over $200 million in staked assets across 30+ networks.",
        poolType: StakingPoolType.LIQUID,
        tokenDecimals: 18,
        tokenSymbol: "shZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhDRGIw",
        address: "0xCDb0B23Db1439b28689844FD093C478d73C0786A",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_ziltomoon.webp",
        name: "2ZilMoon (Make Zilliqa Great Again)",
        description:
          "A community-driven staking pool focused on simplicity, security, and helping Zilliqa shine again. Easy to use, transparent rewards, and built for true ZIL believers.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhEMTIz",
        address: "0xD12340c2D5A26e7f5C469B57ee81EE82c8CB7686",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_citadel.png",
        name: "Citadel.one",
        description:
          "Citadel.one is a multi-asset non-custodial staking platform that lets anyone become a part of decentralized infrastructure and earn passive income. Stake with our nodes or any other validator across multiple networks in a few clicks.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhlNjdl",
        address: "0xe67e119DCdC1168EC8089F4647702A72A0fCBc7f",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_pathrocknetwork.webp",
        name: "PathrockNetwork",
        description:
          "PathrockNetwork provides secure, non-custodial staking for Proof-of-Stake blockchains by operating highly reliable validators across multiple networks. Come and Stake with us.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHg2MDU3",
        address: "0x60571E6c6d55109e6705d17956201a0Cf39f1198",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_rockx.jpg",
        name: "RockX",
        description:
          "The largest Asian-based institutional grade staking and RPC provider.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
    {
      definition: {
        id: "MHhiYTY2",
        address: "0xba669Cc6B49218624E84920dc8136a05411B1Ec8",
        tokenAddress: "0x0000000000000000000000000000000000000000",
        iconUrl: "/static/logo_stakin.jpg",
        name: "Stakin",
        description:
          "[Stakin.com](Stakin.com) Leading institutional-grade web3 infrastructure and non-custodial staking service provider. ISO27001 Certified and Audited.",
        poolType: StakingPoolType.NORMAL,
        tokenDecimals: 18,
        tokenSymbol: "ZIL",
        minimumStake: 100000000000000000000n,
        withdrawPeriodInMinutes: twoWeeksInMinutes,
      },
      delegatorDataProvider: fetchNonLiquidDelegatorDataFromNetwork,
    },
  ],
}

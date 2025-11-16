import { DateTime } from "luxon"
import { getViemClient, MOCK_CHAIN } from "./chainConfig"
import {
  stakingPoolsConfigForChainId,
  StakingPoolType,
} from "./stakingPoolsConfig"
import { readContract } from "viem/actions"
import { Address, erc20Abi, parseUnits } from "viem"
import { baseDelegatorAbi, nonLiquidDelegatorAbi } from "./stakingAbis"

export interface UserStakingPoolData {
  address: string
  stakingTokenAmount: bigint
}

export interface UserNonLiquidStakingPoolRewardData {
  address: string
  zilRewardAmount: bigint
}

export interface UserUnstakingPoolData {
  address: string
  zilAmount: bigint
  availableAt: DateTime
}

export interface DummyWallet {
  name: string
  address: string
  stakingTokenAmount: Array<UserStakingPoolData>
  unstakingEntries: Array<UserUnstakingPoolData>
  nonLiquidRewards: Array<UserNonLiquidStakingPoolRewardData>
  currentZil: bigint
}

export const dummyWallets: Array<DummyWallet> = [
  {
    name: "Mocked wallet 1 - empty wallet",
    address: "0xCF671756a8238cBeB19BCB4D77FC9091E2fCe1A3",
    currentZil: 0n,
    stakingTokenAmount: [],
    unstakingEntries: [],
    nonLiquidRewards: [],
  },
  {
    name: "Mocked wallet 2 - 0 ZIL, but some unstakes",
    address: "0xCF671756a8238cBeB19BCB4D77FC9091E2fCeYYY",
    currentZil: 0n,
    stakingTokenAmount: [],
    unstakingEntries: [
      {
        address: "0x1234567890234567890234567890234567890",
        zilAmount: parseUnits("62712.323", 18),
        availableAt: DateTime.now().minus({ days: 1 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("1000", 18),
        availableAt: DateTime.now().plus({ days: 1 }),
      },
    ],
    nonLiquidRewards: [],
  },
  {
    name: "Mocked wallet 3 - only have ZIL",
    address: "0xf0a9953B539f9E7c4953279859F924d9212B2111",
    currentZil: 1000000000000000000n,
    stakingTokenAmount: [],
    unstakingEntries: [],
    nonLiquidRewards: [],
  },
  {
    name: "Mocked wallet 4 - some liquid stakes",
    address: "0xf0a9953B539f9E7c4953279859F924d9212B9383",
    currentZil: 1000000000000000000n,
    stakingTokenAmount: [
      {
        address: "0x1234567890234567890234567890234567890",
        stakingTokenAmount: parseUnits("1000.50", 18),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        stakingTokenAmount: parseUnits("60.50", 18),
      },
    ],
    unstakingEntries: [],
    nonLiquidRewards: [],
  },
  {
    name: "Mocked wallet 5 - some liquid stakes and unstakes",
    address: "0xf0a9953B539f9E7c4953279859F924d9212B21A9",
    currentZil: 1000000000000000000000n,
    stakingTokenAmount: [
      {
        address: "0x1234567890234567890234567890234567890",
        stakingTokenAmount: parseUnits("1000", 18),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        stakingTokenAmount: parseUnits("9991119", 18),
      },
    ],
    unstakingEntries: [
      {
        address: "0x1234567890234567890234567890234567890",
        zilAmount: parseUnits("9000", 18),
        availableAt: DateTime.now().minus({ days: 1 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1044", 18),
        availableAt: DateTime.now().minus({ days: 5 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().plus({ days: 1 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("500", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("10000", 18),
        availableAt: DateTime.now().plus({ days: 13 }),
      },
    ],
    nonLiquidRewards: [],
  },
  {
    name: "Mocked wallet 6 - stakes, unstakes, rewards on non-liquid",
    address: "0xee00953B539f9E7c4953279859F924d9212B2000",
    currentZil: parseUnits("822", 18),
    stakingTokenAmount: [
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        stakingTokenAmount: parseUnits("150.2", 18),
      },
    ],
    unstakingEntries: [
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("89", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("220.2", 18),
        availableAt: DateTime.now().minus({ days: 5 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("440.2", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
    ],
    nonLiquidRewards: [
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilRewardAmount: parseUnits("10.2", 18),
      },
    ],
  },
  {
    name: "Mocked wallet 7 - LOTS of unstakes",
    address: "0xf0a9953B539f9E7c4953279859F924d9212BBBBBB",
    currentZil: 0n,
    stakingTokenAmount: [
      {
        address: "0x96525678902345678902345678918278372212",
        stakingTokenAmount: parseUnits("123.522039320", 18),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        stakingTokenAmount: parseUnits("99999", 18),
      },
    ],
    unstakingEntries: [
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("89", 18),
        availableAt: DateTime.now().minus({ days: 5 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("123", 18),
        availableAt: DateTime.now().minus({ days: 4 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("1992", 18),
        availableAt: DateTime.now().minus({ days: 3 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("2311", 18),
        availableAt: DateTime.now().minus({ days: 2 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("2311", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0x96525678902345678902345678918278372212",
        zilAmount: parseUnits("122", 18),
        availableAt: DateTime.now().plus({ days: 15 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("220.2", 18),
        availableAt: DateTime.now().minus({ days: 5 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("1111.2", 18),
        availableAt: DateTime.now().minus({ days: 3 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("220.2", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilAmount: parseUnits("440.2", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().plus({ days: 1 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().plus({ days: 5 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().plus({ days: 15 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().plus({ days: 10 }),
      },
      {
        address: "0x82245678902345678902345678918278372382",
        zilAmount: parseUnits("1000000", 18),
        availableAt: DateTime.now().minus({ days: 1 }),
      },
    ],
    nonLiquidRewards: [
      {
        address: "0xe863906941de820bde06701a0d804dd0b8575d67",
        zilRewardAmount: parseUnits("1000.2", 18),
      },
    ],
  },
]

export async function getWalletStakingData(
  wallet: string,
  chainId: number
): Promise<UserStakingPoolData[]> {
  if (chainId === MOCK_CHAIN.id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          dummyWallets.find((dw) => dw.address === wallet)
            ?.stakingTokenAmount || []
        )
      }, 1000)
    })
  } else {
    const stakingData: UserStakingPoolData[] = await Promise.all(
      stakingPoolsConfigForChainId[chainId].map(async (pool) => {
        if (pool.definition.poolType === StakingPoolType.LIQUID) {
          return {
            address: pool.definition.address,
            stakingTokenAmount: await readContract(getViemClient(chainId), {
              address: pool.definition.tokenAddress as Address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet as Address],
            }),
          }
        } else if (pool.definition.poolType === StakingPoolType.NORMAL) {
          return {
            address: pool.definition.address,
            stakingTokenAmount: await readContract(getViemClient(chainId), {
              address: pool.definition.address as Address,
              abi: nonLiquidDelegatorAbi,
              functionName: "getDelegatedAmount",
              account: wallet as Address,
            }),
          }
        } else {
          console.error(`Unknown pool type ${pool.definition.poolType}`, pool)
          return {
            address: pool.definition.address,
            stakingTokenAmount: 0n,
          }
        }
      })
    )

    return stakingData
  }
}

export async function getWalletUnstakingData(
  wallet: string,
  chainId: number
): Promise<UserUnstakingPoolData[]> {
  if (chainId === MOCK_CHAIN.id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          dummyWallets.find((dw) => dw.address === wallet)?.unstakingEntries ||
            []
        )
      }, 1000)
    })
  } else {
    const currentBlockNumber = await getViemClient(chainId).getBlockNumber()

    // get unstaking data from contracts
    const unstakingWalletData = await Promise.all(
      stakingPoolsConfigForChainId[chainId].map(async (pool) => {
        return {
          address: pool.definition.address,
          blockNumberAndAmount: await readContract(getViemClient(chainId), {
            address: pool.definition.address as Address,
            abi: baseDelegatorAbi,
            functionName: "getPendingClaims",
            account: wallet as Address,
          }),
          claimableNow: (await readContract(getViemClient(chainId), {
            address: pool.definition.address as Address,
            abi: baseDelegatorAbi,
            functionName: "getClaimable",
            account: wallet as Address,
          })) as bigint,
        }
      })
    )

    // convert contracts raw data into application data
    const result: UserUnstakingPoolData[] = unstakingWalletData
      .filter(
        (uwd) => uwd.blockNumberAndAmount.length > 0 || uwd.claimableNow > 0
      )
      .map((uwd) => {
        const claims: UserUnstakingPoolData[] = []

        if (uwd.claimableNow > 0) {
          claims.push({
            zilAmount: uwd.claimableNow,
            availableAt: DateTime.now().minus({ days: 1 }), // just to make sure it displays
            address: uwd.address,
          })
        }

        if (uwd.blockNumberAndAmount.length > 0) {
          claims.push(
            ...uwd.blockNumberAndAmount.map((bna) => {
              const blocksRemaining = Number(bna[0] - currentBlockNumber)

              const blocksRemainingInSeconds = blocksRemaining * 1.11 // seconds per block

              return {
                zilAmount: bna[1],
                availableAt: DateTime.now().plus({
                  seconds: blocksRemainingInSeconds,
                }),
                address: uwd.address,
              }
            })
          )
        }

        return claims
      })
      .flat()

    return result
  }
}

export async function getWalletNonLiquidStakingPoolRewardData(
  wallet: string,
  chainId: number
): Promise<UserNonLiquidStakingPoolRewardData[]> {
  if (chainId === MOCK_CHAIN.id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          dummyWallets.find((dw) => dw.address === wallet)?.nonLiquidRewards ||
            []
        )
      }, 1000)
    })
  } else {
    const rewards: Array<UserNonLiquidStakingPoolRewardData> =
      await Promise.all(
        stakingPoolsConfigForChainId[chainId]
          .filter((pool) => pool.definition.poolType === StakingPoolType.NORMAL)
          .map(async (pool) => {
            return {
              address: pool.definition.address,
              zilRewardAmount: await readContract(getViemClient(chainId), {
                address: pool.definition.address as Address,
                abi: nonLiquidDelegatorAbi,
                functionName: "rewards",
                account: wallet as Address,
              }),
            }
          })
      )

    return rewards.filter((r) => r.zilRewardAmount > 0n)
  }
}

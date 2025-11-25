"use client"

import { useEffect, useMemo, useState } from "react"
import { createContainer } from "./context"
import { WalletConnector } from "./walletConnector"
import { DateTime } from "luxon"
import {
  StakingPool,
  stakingPoolsConfigForChainId,
} from "@/misc/stakingPoolsConfig"
import {
  getWalletNonLiquidStakingPoolRewardData,
  getWalletStakingData,
  getWalletUnstakingData,
  UserNonLiquidStakingPoolRewardData,
  UserStakingPoolData,
  UserUnstakingPoolData,
} from "@/misc/walletsConfig"
import { AppConfigStorage } from "./appConfigStorage"
import { useRouter } from "next/router"

// all available withdraws for one delegator are withdrawn using single tx, so we aggregate them to shoow only one UI entry
function mergeAvailableWithdrawUnstakeRequests(
  data: {
    unstakeInfo: UserUnstakingPoolData
    stakingPool: StakingPool
  }[]
) {
  return data
    .reduce(
      (acc, unstakeData) => {
        // if not availble then we want to have a separate entry for it
        if (unstakeData.unstakeInfo.availableAt > DateTime.now()) {
          acc.push(unstakeData)
          return acc
        }

        const existingIdx = acc.findIndex(
          (entry) =>
            entry.stakingPool.definition.id ===
            unstakeData.stakingPool.definition.id
        )

        if (existingIdx !== -1) {
          // if we already have an available entry for this pool, we want to aggregate the zilAmount
          acc[existingIdx] = {
            stakingPool: unstakeData.stakingPool,
            unstakeInfo: {
              availableAt: unstakeData.unstakeInfo.availableAt,
              address: unstakeData.unstakeInfo.address,
              zilAmount:
                unstakeData.unstakeInfo.zilAmount +
                acc[existingIdx].unstakeInfo.zilAmount,
            },
          }
        } else {
          // if we don't yet have an available entry for this pool, we want to add it
          acc.push(unstakeData)
        }

        return acc
      },
      new Array<{
        unstakeInfo: UserUnstakingPoolData
        stakingPool: StakingPool
      }>()
    )
    .toSorted(
      (claimA, claimB) =>
        claimA.unstakeInfo.availableAt.diff(claimB.unstakeInfo.availableAt)
          .milliseconds
    )
}

const useStakingPoolsStorage = () => {
  const router = useRouter()

  const { walletAddress } = WalletConnector.useContainer()

  const { appConfig } = AppConfigStorage.useContainer()

  const [availableStakingPoolsData, setAvailableStakingPoolsData] = useState<
    StakingPool[]
  >([])

  const [userStakingPoolsData, setUserStakingPoolsData] = useState<
    UserStakingPoolData[]
  >([])
  const [userUnstakesData, setUserUnstakesData] = useState<
    UserUnstakingPoolData[]
  >([])
  const [userNonLiquidPoolRewards, setUserNonLiquidPoolRewards] = useState<
    UserNonLiquidStakingPoolRewardData[]
  >([])

  const [stakingPoolForView, setSelectedStakingPool] =
    useState<StakingPool | null>(null)

  const [isUnstakingDataLoading, setIsUnstakingDataLoading] = useState(false)

  /**
   * This interval forces rerender and state recalculation for subset of items
   * that have availableAt property. This is done by simply copying such state.
   * This methid is cheap and does not require any additional API calls.
   * This makes the frontend to properly display the time left and availability
   * for such items
   */
  const _refreshItemsWithAvailableAt = useMemo(
    () =>
      setInterval(() => {
        console.log("Refreshing unstakings")
        setUserUnstakesData((current) => [...current])
        setUserNonLiquidPoolRewards((current) => [...current])
      }, 5000),
    []
  )

  const reloadUserStakingPoolsData = () => {
    if (!walletAddress) {
      setUserStakingPoolsData([])
      setUserUnstakesData([])
      setUserNonLiquidPoolRewards([])
      return
    }

    getWalletStakingData(walletAddress, appConfig!.chainId)
      .then(setUserStakingPoolsData)
      .catch(console.error)
    setIsUnstakingDataLoading(true)
    getWalletUnstakingData(walletAddress, appConfig!.chainId)
      .then(setUserUnstakesData)
      .catch(console.error)
      .finally(() => setIsUnstakingDataLoading(false))

    getWalletNonLiquidStakingPoolRewardData(walletAddress, appConfig!.chainId)
      .then(setUserNonLiquidPoolRewards)
      .catch(console.error)
      .finally(() => setIsUnstakingDataLoading(false))
  }

  useEffect(
    function triggerUserDataLoadingOnWalletConnect() {
      reloadUserStakingPoolsData()
    },
    [walletAddress]
  )

  useEffect(function populateStakingPoolsDefinitionsAndTriggerDataLoading() {
    const stakingPoolsConfig = stakingPoolsConfigForChainId[appConfig.chainId]

    setAvailableStakingPoolsData(
      stakingPoolsConfig.map((configEntry) => ({
        definition: configEntry.definition,
        data: null,
      }))
    )

    Promise.all(
      stakingPoolsConfig.map(async (config) => {
        const data = await config.delegatorDataProvider(
          config.definition,
          appConfig.chainId
        )

        setAvailableStakingPoolsData((prev) => {
          const updated = prev.map((entry) => {
            if (entry.definition.id === config.definition.id) {
              return {
                ...entry,
                data,
              }
            }

            return entry
          })

          return updated
        })
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const poolToShow = router.query.poolId as string | null

    const selectedPool =
      poolToShow &&
      availableStakingPoolsData.find(
        (pool) => pool.definition.id === poolToShow
      )

    if (selectedPool) {
      setSelectedStakingPool(selectedPool)
    } else {
      setSelectedStakingPool(null)
    }
  }, [router.query.poolId, availableStakingPoolsData])

  useEffect(
    function updateStakingForViewOnStakingPoolsDataChange() {
      if (stakingPoolForView) {
        const updatedStakingPool = availableStakingPoolsData.find(
          (pool) => pool.definition.id === stakingPoolForView.definition.id
        )

        if (updatedStakingPool) {
          setSelectedStakingPool(updatedStakingPool)
        }
      }
    },
    [availableStakingPoolsData]
  )

  const selectStakingPoolForView = (stakingPoolId: string | null) => {
    if (!stakingPoolId || stakingPoolId === stakingPoolForView?.definition.id) {
      const currentQuery = router.query
      delete currentQuery.poolId

      router.push(
        {
          query: currentQuery,
        },
        undefined,
        { shallow: true }
      )

      return
    } else {
      router.push(
        {
          query: { poolId: stakingPoolId },
        },
        undefined,
        { shallow: true }
      )
    }
  }

  const combinedStakingPoolsData = availableStakingPoolsData
    .map((stakingPool) => {
      const userStakingPoolData = userStakingPoolsData.find(
        (userPool) => userPool.address === stakingPool.definition.address
      )

      return {
        stakingPool,
        userData: userStakingPoolData,
      }
    })
    .toSorted((a, b) => {
      const diff =
        (b.userData?.stakingTokenAmount || 0n) -
        (a.userData?.stakingTokenAmount || 0n)

      if (diff === 0n) {
        return a.stakingPool.definition.name.localeCompare(
          b.stakingPool.definition.name
        )
      }

      return diff > 0 ? 1 : -1
    })

  const combinedSelectedStakingPoolForViewData = stakingPoolForView
    ? {
        stakingPool: stakingPoolForView,
        userData: {
          staked: userStakingPoolsData.find(
            (userPoolData) =>
              userPoolData.address === stakingPoolForView.definition.address
          ),
          unstaked: mergeAvailableWithdrawUnstakeRequests(
            userUnstakesData
              .filter(
                (userPoolData) =>
                  userPoolData.address === stakingPoolForView.definition.address
              )
              .map((unstakeInfo) => ({
                unstakeInfo,
                stakingPool: stakingPoolForView,
              }))
          ).map((unstakeData) => unstakeData.unstakeInfo),
          reward: userNonLiquidPoolRewards.find(
            (userPoolData) =>
              userPoolData.address === stakingPoolForView.definition.address
          ),
        },
      }
    : null

  const combinedUserUnstakesData =
    userUnstakesData?.map((unstakeInfo) => ({
      unstakeInfo,
      stakingPool: availableStakingPoolsData.find(
        (pool) => pool.definition.address === unstakeInfo.address
      )!,
    })) || []

  const combinedUserNonLiquidPoolRewards =
    userNonLiquidPoolRewards
      ?.filter((rewardInfo) => rewardInfo.zilRewardAmount > 0n)
      .map((rewardInfo) => ({
        rewardInfo,
        stakingPool: availableStakingPoolsData.find(
          (pool) => pool.definition.address === rewardInfo.address
        )!,
      })) || []

  const availableForUnstaking = mergeAvailableWithdrawUnstakeRequests(
    combinedUserUnstakesData.filter(
      (unstakeData) =>
        unstakeData.unstakeInfo.availableAt <= DateTime.now() &&
        unstakeData.unstakeInfo.zilAmount > 0n
    )
  )

  const pendingUnstaking = combinedUserUnstakesData
    .filter(
      (unstakeData) => unstakeData.unstakeInfo.availableAt > DateTime.now()
    )
    .toSorted(
      (claimA, claimB) =>
        claimA.unstakeInfo.availableAt.diff(claimB.unstakeInfo.availableAt)
          .milliseconds
    )

  const getMinimalPoolStakingAmount = (stakinPoolAddress: string) => {
    const stakingPoolData = availableStakingPoolsData.find(
      (pool) => pool.definition.address === stakinPoolAddress
    )

    if (!stakingPoolData) {
      throw new Error("Staking pool not found") // this means that config is invalid
    }

    return stakingPoolData.definition.minimumStake
  }

  return {
    availableStakingPools: availableStakingPoolsData,
    stakingPoolForView: combinedSelectedStakingPoolForViewData,
    selectStakingPoolForView,
    combinedStakingPoolsData,
    availableForUnstaking,
    pendingUnstaking,
    nonLiquidRewards: combinedUserNonLiquidPoolRewards,
    reloadUserStakingPoolsData,
    isUnstakingDataLoading,
    getMinimalPoolStakingAmount,
  }
}

export const StakingPoolsStorage = createContainer(useStakingPoolsStorage)

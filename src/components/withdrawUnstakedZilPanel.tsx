import { StakingOperations } from "@/contexts/stakingOperations"
import { StakingPoolsStorage } from "@/contexts/stakingPoolsStorage"

import {
  formatUnitsToHumanReadable,
  formatUnitsWithPrecision5,
  getHumanFormDuration,
} from "@/misc/formatting"
import { StakingPool, StakingPoolType } from "@/misc/stakingPoolsConfig"
import {
  UserNonLiquidStakingPoolRewardData,
  UserUnstakingPoolData,
} from "@/misc/walletsConfig"
import { Button, Tooltip } from "antd"
import { DateTime } from "luxon"
import { formatUnits } from "viem"
import LastTransaction from "@/components/lastTransaction"

interface WithdrawZilPanelProps {
  stakingPoolData: StakingPool
  userUnstakingPoolData?: Array<UserUnstakingPoolData>
  reward?: UserNonLiquidStakingPoolRewardData
}

const WithdrawZilPanel: React.FC<WithdrawZilPanelProps> = ({
  userUnstakingPoolData,
  stakingPoolData,
  reward,
}) => {
  const {
    claimUnstake,
    isClaimingUnstakeInProgress,
    claimUnstakeCallTxHash,
    preparingClaimUnstakeTx,
    claimReward,
    isClaimingRewardInProgress,
    claimRewardCallTxHash,
    preparingClaimRewardTx,
    stakeReward,
    isStakingRewardInProgress,
    stakeRewardCallTxHash,
    preparingStakeRewardTx,
  } = StakingOperations.useContainer()

  const { getMinimalPoolStakingAmount } = StakingPoolsStorage.useContainer()

  const pendingUnstake = userUnstakingPoolData
    ?.filter((claim) => claim.availableAt > DateTime.now())
    .toSorted(
      (claimA, claimB) =>
        claimA.availableAt.diff(claimB.availableAt).milliseconds
    )

  const availableUnstake =
    userUnstakingPoolData
      ?.filter((claim) => claim.availableAt <= DateTime.now())
      .reduce((acc, claim) => acc + claim.zilAmount, 0n) || 0n

  const hashToShow =
    claimRewardCallTxHash || stakeRewardCallTxHash || claimUnstakeCallTxHash

  const otherPendingClaimsToShow =
    availableUnstake > 0n ? pendingUnstake : pendingUnstake?.slice(1)

  return (
    <div className="h-full">
      <LastTransaction txHash={hashToShow} />

      {reward && (
        <div
          className=" min-h-[100px] lg:min-h-[124px] xl:min-h-[140px] 
            flex flex-col justify-evenly gap-2 4k:gap-3 mb-2.5 lg:mb-4 4k:mb-6 p-3 lg:p-5 xl:p-7 4k:p-10 bg-grey-gradient rounded-xl w-full"
        >
          <div className="items-center h4 w-full flex justify-between text-white1">
            {stakingPoolData.data ? (
              <div>
                <div className="body2">
                  <span
                    className={`${
                      stakingPoolData.definition.poolType ===
                      StakingPoolType.LIQUID
                        ? "text-tealPrimary"
                        : "text-purple3"
                    }`}
                  >
                    Claimable Rewards
                  </span>
                </div>
                <div>
                  {`${formatUnitsWithPrecision5(reward.zilRewardAmount, 18)} ZIL`}
                </div>
              </div>
            ) : (
              <div className="loading-blur">00.00000 ZIL</div>
            )}
            <div className=" lg:w-1/3 max-w-[150px] sm:max-w-[250px] w-full">
              {getMinimalPoolStakingAmount(reward.address) >
              reward.zilRewardAmount ? (
                <Tooltip
                  placement="top"
                  arrow={true}
                  overlayClassName="custom-tooltip"
                  className="mr-1"
                  title={`Reward is less than the minimal staking amount of ${formatUnitsWithPrecision5(
                    getMinimalPoolStakingAmount(reward.address),
                    18
                  )} ZIL`}
                >
                  <Button
                    className={` 
                      ${
                        isStakingRewardInProgress
                          ? stakingPoolData.definition.poolType ===
                            StakingPoolType.LIQUID
                            ? "liquid-loading"
                            : "non-liquid-loading"
                          : ""
                      }
                      ${stakingPoolData.definition.poolType === StakingPoolType.LIQUID ? " liquid-hover" : " non-liquid-hover"} btn-primary-grey lg:py-5 py-4 mb-2.5`}
                    onClick={() => stakeReward(reward.address)}
                    loading={isStakingRewardInProgress}
                    disabled={true}
                  >
                    Stake Reward
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  className={` 
                    ${
                      isStakingRewardInProgress
                        ? stakingPoolData.definition.poolType ===
                          StakingPoolType.LIQUID
                          ? "liquid-loading"
                          : "non-liquid-loading"
                        : ""
                    }
                    ${stakingPoolData.definition.poolType === StakingPoolType.LIQUID ? " liquid-hover" : " non-liquid-hover"} btn-primary-grey lg:py-5 py-4 mb-2.5`}
                  onClick={() => stakeReward(reward.address)}
                  loading={isStakingRewardInProgress}
                >
                  {preparingStakeRewardTx
                    ? "Confirm in wallet"
                    : isStakingRewardInProgress
                      ? "Processing"
                      : "Stake Reward"}
                </Button>
              )}

              <Button
                className={` 
                  ${
                    isClaimingRewardInProgress
                      ? stakingPoolData.definition.poolType ===
                        StakingPoolType.LIQUID
                        ? "liquid-loading"
                        : "non-liquid-loading"
                      : ""
                  }
                  ${stakingPoolData.definition.poolType === StakingPoolType.LIQUID ? " liquid-hover" : " non-liquid-hover"}
                   ${
                     getMinimalPoolStakingAmount(reward.address) >
                     reward.zilRewardAmount
                       ? " btn-primary-grey "
                       : " btn-secondary-grey "
                   }
                 lg:py-5 py-4`}
                onClick={() => claimReward(reward.address)}
                loading={isClaimingRewardInProgress}
              >
                {preparingClaimRewardTx
                  ? "Confirm in wallet"
                  : isClaimingRewardInProgress
                    ? "Processing"
                    : "Claim Reward"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {availableUnstake > 0n ? (
        <div
          className=" min-h-[100px] lg:min-h-[124px] xl:min-h-[140px] 
          flex flex-col justify-evenly gap-2 4k:gap-3 mb-2.5 lg:mb-4 4k:mb-6 p-3 lg:p-5 xl:p-7 4k:p-10 bg-grey-gradient rounded-xl w-full"
        >
          <div className="items-center h4 w-full flex justify-between text-white1">
            {stakingPoolData.data ? (
              <div>
                <div className="body2">
                  <span
                    className={`${
                      stakingPoolData.definition.poolType ===
                      StakingPoolType.LIQUID
                        ? "text-tealPrimary"
                        : "text-purple3"
                    }`}
                  >
                    Claimable Withdrawals
                  </span>
                </div>
                <div>{formatUnitsWithPrecision5(availableUnstake, 18)} ZIL</div>
              </div>
            ) : (
              <div className="loading-blur">00.00000 ZIL</div>
            )}
            <div className="max-lg:gap-2.5 max-lg:flex lg:w-1/3 max-w-[150px] sm:max-w-[250px] w-full">
              <Button
                className={` 
                  ${
                    isClaimingUnstakeInProgress
                      ? stakingPoolData.definition.poolType ===
                        StakingPoolType.LIQUID
                        ? "liquid-loading"
                        : "non-liquid-loading"
                      : ""
                  }
                  ${stakingPoolData.definition.poolType === StakingPoolType.LIQUID ? " liquid-hover" : " non-liquid-hover"} btn-primary-grey lg:py-5 py-4`}
                onClick={() => claimUnstake(stakingPoolData.definition.address)}
                loading={isClaimingUnstakeInProgress}
              >
                {preparingClaimUnstakeTx
                  ? "Confirm in wallet"
                  : isClaimingUnstakeInProgress
                    ? "Processing"
                    : "Claim"}
              </Button>
            </div>
          </div>
        </div>
      ) : !!pendingUnstake?.length ? (
        <div
          className="flex flex-col min-h-[100px] lg:min-h-[132px] xl:min-h-[148px] justify-evenly  
         mb-2.5 lg:mb-4 4k:mb-6 py-2 lg:py-6 xl:py-8 4k:py-10 
         px-3 lg:px-7 xl:px-10 4k:px-14 bg-grey-gradient rounded-xl w-full"
        >
          <div className="body2 text-gray3">
            Next available withdrawal claim
          </div>
          <div className="h4 mt-2 w-full flex justify-between text-white1">
            <div>{getHumanFormDuration(pendingUnstake[0].availableAt)}</div>
            {stakingPoolData.data ? (
              <div>
                {formatUnitsWithPrecision5(pendingUnstake[0].zilAmount, 18)} ZIL
              </div>
            ) : (
              <div className="loading-blur">00.00000</div>
            )}
          </div>
        </div>
      ) : !reward ? (
        <div className="flex justify-center items-center h-full body2 text-gray3 ">
          No available Claims
        </div>
      ) : (
        <></>
      )}

      {!!otherPendingClaimsToShow && (
        <div className="mt-3 ">
          <div className="info-label mb-3">Other pending claims</div>

          {otherPendingClaimsToShow.map((claim, claimIdx) => (
            <div
              className="flex justify-between mb-3 items-center"
              key={claimIdx}
            >
              {stakingPoolData.data ? (
                <div className="flex gap-2.5">
                  <div className="body1 text-white1">
                    {formatUnitsWithPrecision5(claim.zilAmount, 18)} ZIL
                  </div>
                </div>
              ) : (
                <div className="loading-blur">00.00000 ZIL</div>
              )}
              <div className="regular-base text-white1">
                {getHumanFormDuration(claim.availableAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WithdrawZilPanel

import React from "react"
import { formatUnitsToHumanReadable } from "@/misc/formatting"

interface RewardsProgressProps {
  rewardsDiff: bigint
  timeDiff: number
  dailyProjection: bigint
  monthlyProjection: bigint
}

export const RewardsProgress: React.FC<RewardsProgressProps> = ({
  rewardsDiff,
  timeDiff,
  dailyProjection,
  monthlyProjection,
}) => {
  const formatTimeDiff = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days} ${days === 1 ? "day" : "days"} ago`
    } else if (hours > 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
    } else {
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
    }
  }

  const hasProjection = dailyProjection > 0n && monthlyProjection > 0n

  return (
    <div className="teal-border-bottom bg-aqua-gradient rounded-[20px]">
      <div className="flex flex-col justify-center items-center py-6 4k:py-7 px-3 lg:px-9 4k:px-12">
        <div className="text-gray2 body2 mb-2">Rewards Progress</div>
        <div className="bold33 text-white mb-2">
          +{formatUnitsToHumanReadable(rewardsDiff, 18)} ZIL
        </div>
        <div className="text-gray3 body2 mb-3">
          Since last visit ({formatTimeDiff(timeDiff)})
        </div>

        {hasProjection ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between items-center">
              <span className="text-gray2 text-sm">Daily projection:</span>
              <span className="text-white font-semibold">
                {formatUnitsToHumanReadable(dailyProjection, 18)} ZIL
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray2 text-sm">Monthly projection:</span>
              <span className="text-white font-semibold">
                {formatUnitsToHumanReadable(monthlyProjection, 18)} ZIL
              </span>
            </div>
          </div>
        ) : (
          <div className="text-gray3 text-sm">
            Need more data for projection (minimum 1 minute and 0.1 ZIL growth)
          </div>
        )}
      </div>
    </div>
  )
}

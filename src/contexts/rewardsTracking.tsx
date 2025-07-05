import React, { createContext, useContext, useEffect, useState } from "react"

interface RewardsTrackingData {
  lastVisitTime: number
  totalRewards: string // bigint в строке для JSON
  walletAddress: string
  firstVisitTime?: number // добавляем время первого захода
  firstTotalRewards?: string // добавляем первую сумму наград
}

interface RewardsTrackingContextType {
  trackRewards: (totalRewards: bigint, walletAddress: string) => void
  getRewardsDiff: (
    currentRewards: bigint,
    walletAddress: string
  ) => {
    diff: bigint
    timeDiff: number
    dailyProjection: bigint
    monthlyProjection: bigint
  } | null
  hasTrackingData: (walletAddress: string) => boolean
}

const RewardsTrackingContext = createContext<
  RewardsTrackingContextType | undefined
>(undefined)

export const useRewardsTracking = () => {
  const context = useContext(RewardsTrackingContext)
  if (!context) {
    throw new Error(
      "useRewardsTracking must be used within a RewardsTrackingProvider"
    )
  }
  return context
}

export const RewardsTrackingProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const getStorageKey = (walletAddress: string) =>
    `rewards_tracking_${walletAddress}`

  const trackRewards = (totalRewards: bigint, walletAddress: string) => {
    if (!isClient) return

    const existingData = localStorage.getItem(getStorageKey(walletAddress))
    let firstVisitTime = Date.now()
    let firstTotalRewards = totalRewards.toString()

    // Если данные уже есть, сохраняем первоначальные значения
    if (existingData) {
      try {
        const parsed: RewardsTrackingData = JSON.parse(existingData)
        firstVisitTime = parsed.firstVisitTime || parsed.lastVisitTime
        firstTotalRewards = parsed.firstTotalRewards || parsed.totalRewards
      } catch (error) {
        // Игнорируем ошибки парсинга
      }
    }

    const data: RewardsTrackingData = {
      lastVisitTime: Date.now(),
      totalRewards: totalRewards.toString(),
      walletAddress,
      firstVisitTime,
      firstTotalRewards,
    }

    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(data))
  }

  const getRewardsDiff = (currentRewards: bigint, walletAddress: string) => {
    if (!isClient) return null

    const storedData = localStorage.getItem(getStorageKey(walletAddress))
    if (!storedData) {
      return null
    }

    try {
      const data: RewardsTrackingData = JSON.parse(storedData)
      const previousRewards = BigInt(data.totalRewards)

      // Фиксируем время разницы при первом вызове
      const fixedTimeDiff = Date.now() - data.lastVisitTime
      const rewardsDiff = currentRewards - previousRewards

      // Показываем только если есть рост наград
      if (rewardsDiff <= 0n) {
        return null
      }

      // Минимальные требования для показа проекции: 1 минута и рост на 0.1 ZIL
      const minTimeMs = 60 * 1000 // 1 минута
      const minRewardsDiff = BigInt("100000000000000000") // 0.1 ZIL в wei

      const hasProjection =
        fixedTimeDiff >= minTimeMs && rewardsDiff >= minRewardsDiff

      let dailyProjection = 0n
      let monthlyProjection = 0n

      if (hasProjection) {
        // Рассчитываем проекцию на основе ФИКСИРОВАННОГО времени
        const rewardsPerMs = Number(rewardsDiff) / fixedTimeDiff
        const dailyMs = 24 * 60 * 60 * 1000
        const monthlyMs = 30 * 24 * 60 * 60 * 1000

        dailyProjection = BigInt(Math.floor(rewardsPerMs * dailyMs))
        monthlyProjection = BigInt(Math.floor(rewardsPerMs * monthlyMs))
      }

      return {
        diff: rewardsDiff,
        timeDiff: fixedTimeDiff, // Возвращаем фиксированное время
        dailyProjection,
        monthlyProjection,
      }
    } catch (error) {
      return null
    }
  }

  const hasTrackingData = (walletAddress: string) => {
    if (!isClient) return false
    return localStorage.getItem(getStorageKey(walletAddress)) !== null
  }

  return (
    <RewardsTrackingContext.Provider
      value={{
        trackRewards,
        getRewardsDiff,
        hasTrackingData,
      }}
    >
      {children}
    </RewardsTrackingContext.Provider>
  )
}

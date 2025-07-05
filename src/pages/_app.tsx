import "@/styles/globals.css"
import "tailwindcss/tailwind.css"
import "@rainbow-me/rainbowkit/styles.css"
import { StakingPoolsStorage } from "@/contexts/stakingPoolsStorage"
import type { AppProps } from "next/app"
import { WalletConnector } from "@/contexts/walletConnector"
import DummyWalletSelector from "@/components/dummyWalletSelector"
import { ConfigProvider } from "antd"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { StakingOperations } from "@/contexts/stakingOperations"
import { getWagmiConfig } from "@/misc/chainConfig"
import { useEffect, useState } from "react"
import { AppConfig } from "./api/config"
import { AppConfigStorage } from "@/contexts/appConfigStorage"
import Head from "next/head"
import { GoogleTagManager } from "@next/third-parties/google"
import { RewardsTrackingProvider } from "@/contexts/rewardsTracking"

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null)

  const [loadingSplashVisible, setLoadingSplashVisible] =
    useState<boolean>(true)
  const [loadingPercentage, setLoadingPercentage] = useState<number>(0)
  const [pageLoadStartTime] = useState<number>(Date.now())
  const intervalRateMiliseconds = 16
  const minimalLoadingTime = 1500

  useEffect(function loadAppConfig() {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config")
        const data = await res.json()
        setAppConfig(data)
      } catch (error) {
        console.error("Error loading config:", error)
      }
    }

    fetchConfig()
  }, [])

  const [loadingInterval] = useState<NodeJS.Timeout>(
    setInterval(function updateLoadingProgressState() {
      let newProgressValue = Math.min(
        (Date.now() - pageLoadStartTime) / minimalLoadingTime,
        1
      )

      if (newProgressValue >= 1) {
        newProgressValue = 1
        clearInterval(loadingInterval)
      }

      setLoadingPercentage(Math.round(newProgressValue * 100))
    }, intervalRateMiliseconds)
  )

  const fadeOut = loadingPercentage >= 100 && appConfig
  useEffect(
    function fadeOutLoadingScreen() {
      if (fadeOut) {
        setTimeout(() => {
          setLoadingSplashVisible(false)
        }, 500)
      }
    },
    [fadeOut]
  )

  return (
    <div className="relative">
      <Head>
        <title>Zilliqa Staking</title>
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.ico"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.ico"
        />
      </Head>

      {loadingSplashVisible && (
        <div
          className={`absolute left-0 top-0 !z-[100] h-screen w-screen bg-black text-white transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className=" text-end text-2xl lg:text-3xl font-extrabold sm:mr-10 sm:mt-9 sm:mb-2 mr-5 mt-5 mb-1">
            {Math.round(loadingPercentage / 10) * 10}%
          </div>

          <div className="w-full h-[2px] ">
            <div
              className="h-full bg-colorful-gradient"
              style={{
                width: `${loadingPercentage}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {appConfig && (
        <AppConfigStorage.Provider initialState={{ appConfig }}>
          <GoogleTagManager gtmId={appConfig.gtmId} />
          <ConfigProvider>
            <WagmiProvider
              config={getWagmiConfig(
                appConfig.chainId,
                appConfig.walletConnectPrivateKey,
                appConfig.appUrl
              )}
              reconnectOnMount={true}
            >
              <QueryClientProvider client={queryClient}>
                <RainbowKitProvider showRecentTransactions={true}>
                  <WalletConnector.Provider>
                    <StakingPoolsStorage.Provider>
                      <StakingOperations.Provider>
                        <RewardsTrackingProvider>
                          <Component {...pageProps} />
                          <DummyWalletSelector />
                        </RewardsTrackingProvider>
                      </StakingOperations.Provider>
                    </StakingPoolsStorage.Provider>
                  </WalletConnector.Provider>
                </RainbowKitProvider>
              </QueryClientProvider>
            </WagmiProvider>
          </ConfigProvider>
        </AppConfigStorage.Provider>
      )}
    </div>
  )
}

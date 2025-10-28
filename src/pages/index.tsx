import LoginView from "@/components/loginView"
import StakingPoolDetailsView from "@/components/stakingPoolDetailsView"
import StakingPoolsList from "@/components/stakingPoolsList"
import WithdrawZilView from "@/components/withdrawZilView"
import BridgeView from "@/components/bridgeView"
import TabNavigation, { TabType } from "@/components/tabNavigation"
import { AppConfigStorage } from "@/contexts/appConfigStorage"
import { StakingOperations } from "@/contexts/stakingOperations"
import { StakingPoolsStorage } from "@/contexts/stakingPoolsStorage"
import { WalletConnector } from "@/contexts/walletConnector"
import Intercom from "@intercom/messenger-js-sdk"
import { Modal } from "antd"
import Image from "next/image"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import ArrowBackAqua from "../assets/svgs/arrow-back-aqua.svg"
import CustomWalletConnect from "@/components/customWalletConnect"
import MobilePopup from "@/components/mobilePopup"
import ZilGiveaway from "@/components/zilGiveaway"
import { StakingPoolType } from "@/misc/stakingPoolsConfig"
import Link from "next/link"
import Head from "next/head"

const HomePage = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [viewClaim, setViewClaim] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("stake")

  // Handle tab changes with URL updates
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    router.push(
      {
        pathname: "/",
        query: tab === "bridge" ? { tab: "bridge" } : {},
      },
      undefined,
      { shallow: true }
    )
  }

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const { appConfig, isPreviewAuthenticated } = AppConfigStorage.useContainer()
  const router = useRouter()

  // Initialize tab from URL
  useEffect(() => {
    if (router.query.tab === "bridge") {
      setActiveTab("bridge")
    }
  }, [router.query.tab])

  if (appConfig.appUrl === "https://stake.zilliqa.com") {
    router.replace("/coming-soon")
  }

  if (
    appConfig.appUrl === "https://stake-preview.zilliqa.com" &&
    !isPreviewAuthenticated
  ) {
    router.replace("/preview_auth")
  }

  const { isWalletConnected, walletAddress } = WalletConnector.useContainer()

  const {
    dummyWalletPopupContent,
    isDummyWalletPopupOpen,
    setIsDummyWalletPopupOpen,
  } = StakingOperations.useContainer()

  const {
    stakingPoolForView,
    selectStakingPoolForView,
    availableForUnstaking,
    pendingUnstaking,
  } = StakingPoolsStorage.useContainer()

  const [mobileShowClaims, setMobileShowClaims] = useState<boolean>(false)

  useEffect(() => {
    if (walletAddress) {
      Intercom({
        app_id: appConfig.intercomKey,
        user_id: walletAddress,
      })
    }
  }, [walletAddress])

  useEffect(() => {
    if (router.query.claims) {
      selectStakingPoolForView(null)
      setMobileShowClaims(true)
    } else {
      setMobileShowClaims(false)
    }
  }, [router.query.claims])

  const mobileOverlayWrapper = (children: React.ReactNode) => (
    <div className="absolute lg:hidden top-0 left-0 z-25 h-full w-full lg:bg-black1/65 max-lg:pb-12 py-5 4k:p-6 border-t-[0.6px] border-[#4B4B4B] rounded-t-3xl">
      {children}
    </div>
  )

  const desktopColumnContent = (
    <div className="hidden lg:block h-full 4k:h-[70vh] max-4k:items-center overflow-hidden">
      {!isWalletConnected && !stakingPoolForView ? (
        <LoginView />
      ) : stakingPoolForView ? (
        <div className="bg-black1/[68%] 4k:rounded-2.5xl rounded-tl-2.5xl h-full">
          <StakingPoolDetailsView
            stakingPoolData={stakingPoolForView.stakingPool}
            userStakingPoolData={stakingPoolForView.userData.staked}
            userUnstakingPoolData={stakingPoolForView.userData.unstaked}
            viewClaim={viewClaim}
            reward={stakingPoolForView.userData.reward}
          />
        </div>
      ) : (
        <WithdrawZilView setViewClaim={setViewClaim} />
      )}
    </div>
  )

  const mobileOverlayContent =
    mobileShowClaims && !stakingPoolForView
      ? mobileOverlayWrapper(<WithdrawZilView setViewClaim={setViewClaim} />)
      : stakingPoolForView &&
        mobileOverlayWrapper(
          <StakingPoolDetailsView
            stakingPoolData={stakingPoolForView.stakingPool}
            userStakingPoolData={stakingPoolForView.userData.staked}
            userUnstakingPoolData={stakingPoolForView.userData.unstaked}
            reward={stakingPoolForView.userData.reward}
          />
        )

  const mobileBottomNavition =
    activeTab === "stake" ? (
      <div className="fixed bottom-0 left-0 lg:hidden w-full mt-7t-1.5">
        <div className="flex justify-between items-center gap-1 mb-5 mt-2 mx-5 md:mx-7">
          {isWalletConnected ? (
            <>
              <div className="flex justify-between items-center w-full max-lg:mr-16">
                {mobileShowClaims || stakingPoolForView ? (
                  <div className="max-lg:w-full lg:min-w-[320px] mx-auto">
                    <div
                      className="justify-start flex items-center bold12"
                      onClick={() => {
                        router.back()
                      }}
                    >
                      <Image
                        className="mr-2 xs:mr-3 transform transition-transform ease-out duration-500 group-hover:-translate-x-2"
                        src={ArrowBackAqua}
                        alt={"arrow icon"}
                        width={8}
                        height={4.5}
                      />
                      Back
                    </div>
                  </div>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-3">
                  <div
                    className={`justify-start bold12 relative max-lg:w-full lg:min-w-[320px] mx-auto whitespace-nowrap
                        ${!mobileShowClaims || (mobileShowClaims && stakingPoolForView) ? "text-tealPrimary" : "text-gray1"}
                        `}
                    onClick={() => {
                      if (stakingPoolForView) {
                        return
                      }

                      router.push(
                        {
                          query: {},
                        },
                        undefined,
                        { shallow: true }
                      )
                    }}
                  >
                    {stakingPoolForView
                      ? `${stakingPoolForView.stakingPool.definition.name}`
                      : "Validators"}

                    <span
                      className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 w-1 h-1
                  ${!mobileShowClaims || (mobileShowClaims && stakingPoolForView) ? "bg-tealPrimary " : " bg-transparent"}
                     rounded-full`}
                    />
                  </div>

                  <div
                    className={`h-inherit
                      ${stakingPoolForView ? "w-1/2" : "w-full"}`}
                  >
                    <div
                      className={
                        "justify-start flex items-center whitespace-nowrap "
                      }
                      onClick={() => {
                        router.push(
                          {
                            query: { claims: true },
                          },
                          undefined,
                          { shallow: true }
                        )
                      }}
                    >
                      <div
                        className={` relative
                    ${mobileShowClaims && !stakingPoolForView ? "text-tealPrimary" : "text-gray1"}
                   whitespace-nowrap bold12`}
                      >
                        Claims
                        {mobileShowClaims && !stakingPoolForView && (
                          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-1 h-1 bg-tealPrimary rounded-full" />
                        )}
                      </div>
                      {availableForUnstaking.length + pendingUnstaking.length !=
                        0 && (
                        <div
                          className={`bg-red1 text-white rounded-full px-2 h-4 w-4
                      text-8 font-bold p-0.5 ml-1 mb-5 items-center flex justify-center
                     ${availableForUnstaking.length + pendingUnstaking.length != 0 && "text-white"}`}
                        >
                          {availableForUnstaking.length +
                            pendingUnstaking.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {stakingPoolForView && (
                <div className="w-1/2">
                  <div className="max-lg:w-full lg:min-w-[320px] mx-auto">
                    <div
                      className="justify-start flex items-center bold12"
                      onClick={() => {
                        router.back()
                      }}
                    >
                      <Image
                        className="mr-2 xs:mr-3 transform transition-transform ease-out duration-500 group-hover:-translate-x-2"
                        src={ArrowBackAqua}
                        alt={"arrow icon"}
                        width={8}
                        height={4.5}
                      />
                      Back
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    ) : null

  const [isOpen, setIsOpen] = useState(true)

  interface LogoProps {
    selectedPoolType: StakingPoolType
    onClick?: () => void
  }

  const Logo: React.FC<LogoProps> = ({ selectedPoolType, onClick }) => {
    const [color, setFillColor] = useState("#00D0C6")
    useEffect(() => {
      setFillColor(() => {
        switch (selectedPoolType) {
          case StakingPoolType.NORMAL:
            return "#5B6FFF"
          case StakingPoolType.LIQUID:
            return "#00D0C6"
          default:
            return "#00D0C6"
        }
      })
    }, [selectedPoolType])

    return (
      <div className="flex items-center">
        {/* desktop logo */}
        <svg
          width="50"
          height="50"
          viewBox="0 0 162 55"
          className="min-w-32 min-h-12 cursor-pointer  max-lg:hidden"
          onClick={onClick}
        >
          <defs>
            <style>
              {`
              .st0 { fill: ${color}; }
              .st1 { fill: #d8d8d8; }
              .st2 { fill: #fff; }
              .st3 { fill: #afafaf; }
            `}
            </style>
          </defs>
          <path
            className="st0"
            d="M56,50.1c-.7,0-1.4,0-2-.3-.6-.2-1.2-.5-1.5-.8l.6-1.3c.4.3.8.5,1.4.7s1.1.3,1.7.3.9,0,1.2-.2.5-.2.6-.4c.1-.2.2-.4.2-.6s0-.5-.3-.7c-.2-.2-.5-.3-.8-.4-.3-.1-.7-.2-1.1-.3-.4,0-.8-.2-1.2-.3-.4-.1-.7-.3-1.1-.5-.3-.2-.6-.4-.8-.8-.2-.3-.3-.7-.3-1.2s.1-.9.4-1.4c.3-.4.7-.7,1.2-1,.5-.3,1.2-.4,2.1-.4s1.1,0,1.6.2c.5.1,1,.3,1.4.6l-.5,1.3c-.4-.2-.8-.4-1.3-.5-.4-.1-.8-.2-1.2-.2s-.8,0-1.1.2c-.3.1-.5.3-.6.4-.1.2-.2.4-.2.6s0,.5.3.7c.2.2.5.3.8.4.3,0,.7.2,1.1.3.4,0,.8.2,1.2.3.4.1.7.3,1.1.4.3.2.6.4.8.7.2.3.3.7.3,1.2s-.1.9-.4,1.4c-.3.4-.7.7-1.2,1-.5.2-1.2.4-2.1.4ZM63.4,50v-7.7h-3v-1.4h7.7v1.4h-3v7.7h-1.7ZM67.9,50l4.1-9.1h1.7l4.1,9.1h-1.8l-3.5-8.2h.7l-3.5,8.2h-1.7ZM69.8,47.9l.5-1.3h4.9l.5,1.3h-5.8ZM80.7,47.9v-2c0,0,4.7-5,4.7-5h1.9l-4,4.2-.9,1-1.7,1.7ZM79.2,50v-9.1h1.7v9.1h-1.7ZM85.5,50l-3.5-4.1,1.1-1.2,4.3,5.4h-2ZM88.9,50v-9.1h1.7v9.1h-1.7ZM93.3,50v-9.1h1.4l5.7,7h-.7v-7h1.7v9.1h-1.4l-5.7-7h.7v7h-1.7ZM108.3,50.1c-.7,0-1.4-.1-2-.3-.6-.2-1.1-.6-1.5-1-.4-.4-.8-.9-1-1.5-.2-.6-.4-1.2-.4-1.9s.1-1.3.4-1.9c.2-.6.6-1.1,1-1.5.5-.4,1-.7,1.6-1,.6-.2,1.3-.4,2-.4s1.5.1,2.1.4c.6.3,1.1.6,1.6,1.1l-1.1,1c-.4-.4-.7-.6-1.2-.8-.4-.2-.9-.3-1.4-.3s-.9,0-1.3.2c-.4.2-.8.4-1.1.7-.3.3-.5.6-.7,1-.2.4-.2.8-.2,1.3s0,.9.2,1.3c.2.4.4.7.7,1,.3.3.6.5,1,.7.4.2.8.2,1.3.2s.9,0,1.3-.2c.4-.1.8-.4,1.2-.7l1,1.3c-.5.4-1,.7-1.7.9-.6.2-1.3.3-1.9.3ZM110.3,48.8v-3.4h1.6v3.6l-1.6-.2Z"
          />
          <path
            className="st2"
            d="M28.3,26.1l-18.7,9.2,18.7,8.9v7.2L1,38.5v-7.1l19-9.3L1,13.1v-7.2l27.3,12.9v7.3Z"
          />
          <path className="st1" d="M1,5.9l7.2-2.9,27.3,12.9-7.2,2.9L1,5.9Z" />
          <path className="st3" d="M28.3,26.1l7.2-2.9v-7.3l-7.2,2.9v7.3Z" />
          <path
            className="st3"
            d="M28.3,44.2v-14.3l7.2-3.3v21.9l-7.2,2.9v-7.2Z"
          />
          <path
            className="st2"
            d="M55.8,27.8h10.8v3.2h-16.4l11.1-19.4h-9.3v-3.2h14.9l-11.1,19.4Z"
          />
          <path className="st2" d="M74,8.4v22.6h-3.4V8.4h3.4Z" />
          <path className="st2" d="M82.9,8.4v19.4h6.6v3.2h-10.1V8.4h3.4Z" />
          <path className="st2" d="M96.1,8.4v19.4h6.6v3.2h-10V8.4h3.4Z" />
          <path className="st2" d="M109.4,8.4v22.6h-3.4V8.4h3.4Z" />
          <path
            className="st2"
            d="M137.8,31.4h-4.3l-1.8-1.8c-1.9,1.2-4,1.9-6.3,1.8-2.9,0-5.8-1.1-8-3.1-2.5-2.1-3.9-5.3-3.8-8.5,0-3.2,1.2-6.3,3.6-8.5,4.4-4.3,11.3-4.4,15.9-.4,2.7,2.3,4.1,5.4,4.1,9.1s-1.1,5.5-3.2,7.8l3.7,3.7h0ZM128.4,22l3.3,3.3c1.4-1.5,2.2-3.5,2.2-5.6,0-2.3-.8-4.5-2.4-6.1-3.3-3.3-8.6-3.3-12,0-1.6,1.6-2.3,3.7-2.3,6.2,0,2.2.8,4.4,2.4,6,1.5,1.5,3.6,2.4,5.8,2.4,1.4,0,2.8-.3,4-1l-5.3-5.1h4.4,0Z"
          />
          <path
            className="st2"
            d="M154.9,25.5h-9.7l-2.5,5.5h-3.7l11.2-24,10.8,24h-3.7l-2.3-5.5h0ZM153.4,22.3l-3.3-7.7-3.5,7.7h6.8Z"
          />
        </svg>

        {/* mobile logo */}
        <svg
          viewBox="0 0 88 27"
          className="h-8 sm:h-10 w-auto cursor-pointer lg:hidden"
          onClick={onClick}
        >
          <defs>
            <style>
              {`
              .st0 { fill: ${color}; }
              .st1 { fill: #d8d8d8; }
              .st2 { fill: #fff; }
              .st3 { fill: #afafaf; }
            `}
            </style>
          </defs>
          <path
            className="st0 max-xxs:hidden"
            d="M34.7,18.1c-.6,0-1.1,0-1.6-.2-.5-.2-.9-.4-1.2-.6l.5-1c.3.2.6.4,1.1.6.4.2.9.2,1.3.2s.7,0,.9-.1c.2,0,.4-.2.5-.3.1-.1.2-.3.2-.5s0-.4-.2-.5c-.2-.1-.4-.2-.6-.3-.2,0-.5-.2-.8-.2-.3,0-.6-.1-.9-.2-.3,0-.6-.2-.8-.4-.2-.2-.4-.4-.6-.6-.2-.2-.2-.6-.2-.9s.1-.7.3-1.1c.2-.3.5-.6,1-.8.4-.2,1-.3,1.6-.3s.9,0,1.3.2c.4.1.8.3,1.1.5l-.4,1c-.3-.2-.7-.3-1-.4-.3,0-.7-.1-1-.1s-.7,0-.9.1c-.2,0-.4.2-.5.4-.1.1-.2.3-.2.5s0,.4.2.5c.2.1.4.2.6.3.3,0,.5.2.8.2.3,0,.6.1.9.2.3,0,.6.2.8.4.3.1.5.3.6.6.2.2.2.6.2.9s-.1.7-.3,1.1c-.2.3-.5.6-1,.8-.4.2-1,.3-1.6.3ZM40.5,18v-6.1h-2.4v-1.1h6.1v1.1h-2.4v6.1h-1.3ZM44.1,18l3.2-7.2h1.3l3.3,7.2h-1.4l-2.8-6.5h.5l-2.8,6.5h-1.4ZM45.6,16.3l.4-1.1h3.9l.4,1.1h-4.6ZM54.2,16.3v-1.6c0,0,3.7-3.9,3.7-3.9h1.5l-3.1,3.3-.7.8-1.3,1.4ZM53,18v-7.2h1.3v7.2h-1.3ZM58,18l-2.8-3.3.9-1,3.4,4.3h-1.6ZM60.7,18v-7.2h1.3v7.2h-1.3ZM64.2,18v-7.2h1.1l4.5,5.6h-.5v-5.6h1.3v7.2h-1.1l-4.5-5.6h.5v5.6h-1.3ZM76.1,18.1c-.6,0-1.1,0-1.6-.3-.5-.2-.9-.4-1.2-.8-.4-.3-.6-.7-.8-1.2-.2-.5-.3-.9-.3-1.5s0-1,.3-1.5c.2-.5.5-.8.8-1.2.4-.3.8-.6,1.2-.8.5-.2,1-.3,1.6-.3s1.2,0,1.6.3c.5.2.9.5,1.2.9l-.8.8c-.3-.3-.6-.5-.9-.6-.3-.1-.7-.2-1.1-.2s-.7,0-1.1.2c-.3.1-.6.3-.8.5-.2.2-.4.5-.5.8-.1.3-.2.6-.2,1s0,.7.2,1c.1.3.3.6.5.8.2.2.5.4.8.5.3.1.7.2,1.1.2s.7,0,1-.2c.3-.1.7-.3,1-.6l.8,1c-.4.3-.8.5-1.3.7-.5.2-1,.2-1.5.2ZM77.7,17v-2.7h1.3v2.9l-1.3-.2Z"
          />
          <path
            className="st2"
            d="M19.2,13.1l-9.8,4.8,9.8,4.6v3.7l-14.2-6.7v-3.7l9.9-4.9L5,6.3v-3.7l14.2,6.7v3.8Z"
          />
          <path className="st1" d="M5,2.5l3.8-1.5,14.2,6.7-3.8,1.5L5,2.5Z" />
          <path className="st3" d="M19.2,13.1l3.8-1.5v-3.8l-3.8,1.5v3.8Z" />
          <path
            className="st3"
            d="M19.2,22.5v-7.5l3.8-1.7v11.4l-3.8,1.5v-3.7Z"
          />
        </svg>
      </div>
    )
  }

  const [selectedPoolType, setSelectedPoolType] = useState(
    StakingPoolType.LIQUID
  )

  // Автоматическое переключение вкладки по типу выбранного пула
  useEffect(() => {
    if (stakingPoolForView) {
      const poolType = stakingPoolForView.stakingPool.definition.poolType
      if (selectedPoolType !== poolType) {
        setSelectedPoolType(poolType)
      }
    }
  }, [stakingPoolForView])

  //change this to true to show the alert when having issues in the site
  const [showAlert] = useState(false)

  return (
    <>
      <Head>
        <title>
          {activeTab === "bridge"
            ? "🌉 Zilliqa Bridge - Cross-chain transfers"
            : "✅ Zilliqa Staking - Stake ZIL and earn rewards"}
        </title>
      </Head>
      <div
        className={`h-screen w-screen relative transition-opacity duration-1000 overflow-hidden flex flex-col gap-3 lg:gap-[4vh] ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Header */}
        <div className="w-full flex flex-col items-center justify-center text-white border-b-[0.5px] border-gray3">
          <div className="flex max-w-screen-2xl w-full justify-between px-4 lg:px-8 xl:px-12 4k:px-16 4k:max-w-screen-4k items-center py-4 lg:py-5">
            <div className="flex flex-col items-start">
              <Logo
                selectedPoolType={selectedPoolType}
                onClick={() =>
                  router.push({ query: {} }, undefined, { shallow: true })
                }
              />
              <div className="text-xs font-bold mt-1 text-tealPrimary">
                Not official Zilliqa staking portal
              </div>
            </div>

            <div className="flex gap-2 sm:gap-2.5 items-center">
              {isWalletConnected && <ZilGiveaway />}
              <CustomWalletConnect notConnectedClassName="btn-primary-teal sm:px-10 w-full sm:max-w-fit">
                Connect wallet
              </CustomWalletConnect>
            </div>
          </div>
          {showAlert && (
            <div className="w-full bg-red1 px-4 text-center text-sm font-bold leading-[1.2] py-2">
              We&apos;re experiencing issues with chain, platform might not be
              responsive.
            </div>
          )}
        </div>
        <div
          className={`grow relative mx-auto max-w-screen-4k w-full ${
            activeTab === "stake" ? "overflow-y-hidden" : "overflow-y-auto"
          }`}
        >
          {/* Tab Navigation */}
          <div className="px-4 lg:px-8 xl:px-12 4k:px-16">
            <TabNavigation
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>

          {activeTab === "stake" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 4k:gap-14 h-full max-lg:pb-16">
              {/* Left column */}
              <div
                className={`lg:bg-white/[9%] py-4 xs:py-6 4k:py-10 max-4k:rounded-s-none rounded-tr-2.5xl ${mobileOverlayContent && "max-lg:hidden"} overflow-hidden h-full flex flex-col `}
              >
                <StakingPoolsList
                  selectedPoolType={selectedPoolType}
                  setSelectedPoolType={setSelectedPoolType}
                  setViewClaim={setViewClaim}
                />
              </div>

              {desktopColumnContent}

              {mobileOverlayContent}

              <MobilePopup
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                isWalletConnected={!!isWalletConnected}
              />

              {mobileBottomNavition}
            </div>
          ) : (
            <div className="px-4 lg:px-8 xl:px-12 4k:px-16 lg:h-full">
              <BridgeView />
            </div>
          )}
        </div>

        <Modal
          title="User Wallet Interaction"
          open={isDummyWalletPopupOpen}
          okButtonProps={{ className: "btn-primary-cyan" }}
          okText="Confirm tx"
          cancelText="Cancel"
          onOk={dummyWalletPopupContent?.onOk}
          onCancel={dummyWalletPopupContent?.onCancel}
        >
          <div>{dummyWalletPopupContent?.content}</div>
        </Modal>
      </div>
    </>
  )
}

export default HomePage

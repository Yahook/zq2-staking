import { useState } from "react"

export type TabType = "stake" | "bridge"

interface TabNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex items-center justify-center w-full mb-6 lg:mb-8">
      <div className="flex bg-gray3/20 rounded-full p-1 border border-gray3/30">
        <button
          onClick={() => onTabChange("stake")}
          className={`px-6 lg:px-8 py-2 lg:py-2.5 rounded-full font-bold text-sm lg:text-base transition-all duration-300 ease-in-out ${
            activeTab === "stake"
              ? "bg-tealPrimary text-black shadow-[0px_0px_8.2px_1.5px_#00FFF3]"
              : "text-gray1 hover:text-white"
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => onTabChange("bridge")}
          className={`px-6 lg:px-8 py-2 lg:py-2.5 rounded-full font-bold text-sm lg:text-base transition-all duration-300 ease-in-out ${
            activeTab === "bridge"
              ? "bg-tealPrimary text-black shadow-[0px_0px_8.2px_1.5px_#00FFF3]"
              : "text-gray1 hover:text-white"
          }`}
        >
          Bridge
        </button>
      </div>
    </div>
  )
}

export default TabNavigation

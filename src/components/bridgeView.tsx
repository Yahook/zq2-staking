import { useState } from "react"
import { BridgeWidget, BridgeFeeInfo } from "./bridgeWidget"
import { AFFILIATE_DEFAULT_PERCENT } from "@/misc/bridgeConfig"
import WalletDebugInfo from "./walletDebugInfo"

const BridgeView: React.FC = () => {
  const [feePercent, setFeePercent] = useState<number>(
    AFFILIATE_DEFAULT_PERCENT
  )

  return (
    <div className="min-h-screen lg:min-h-full flex flex-col lg:flex-row gap-6 lg:gap-8 pb-8 lg:pb-0">
      {/* Bridge Widget */}
      <div className="flex-1 bg-black1/[68%] rounded-2.5xl p-4 lg:p-6 min-h-[800px] lg:min-h-0 lg:h-full">
        <div className="mb-4 lg:mb-6">
          <h2 className="bold22 lg:bold33 mb-2">Bridge</h2>
          <p className="regular-base">
            Cross-chain swaps & transfers via deBridge.
          </p>
        </div>
        <BridgeWidget className="w-full" onAffiliateFeeChange={setFeePercent} />
      </div>

      {/* Fee Information - Desktop */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <BridgeFeeInfo feePercent={feePercent} />
      </div>

      {/* Fee Information - Mobile */}
      <div className="lg:hidden">
        <BridgeFeeInfo feePercent={feePercent} />
      </div>

      {/* Debug Info - Development Only */}
      <WalletDebugInfo />
    </div>
  )
}

export default BridgeView

import { useState } from "react"
import { BridgeWidget, BridgeFeeInfo } from "./bridgeWidget"
import { AFFILIATE_DEFAULT_PERCENT } from "@/misc/bridgeConfig"

const BridgeView: React.FC = () => {
  const [feePercent, setFeePercent] = useState<number>(
    AFFILIATE_DEFAULT_PERCENT
  )

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Bridge Widget */}
      <div className="flex-1 bg-black1/[68%] rounded-2.5xl overflow-hidden h-full flex flex-col">
        <div className="p-4 lg:p-6 pb-2 lg:pb-4 flex-shrink-0">
          <h2 className="bold22 lg:bold33 mb-2">Bridge</h2>
          <p className="regular-base">
            Cross-chain swaps & transfers via deBridge.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-aqua px-4 lg:px-6 pb-4 lg:pb-6">
          <BridgeWidget
            className="w-full"
            onAffiliateFeeChange={setFeePercent}
          />
        </div>
      </div>

      {/* Fee Information - Desktop */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <BridgeFeeInfo feePercent={feePercent} />
      </div>

      {/* Fee Information - Mobile */}
      <div className="lg:hidden mt-4">
        <BridgeFeeInfo feePercent={feePercent} />
      </div>
    </div>
  )
}

export default BridgeView

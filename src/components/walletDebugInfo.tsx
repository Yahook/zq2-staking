import { useBridgeWallets } from "@/hooks/useBridgeWallets"

const WalletDebugInfo: React.FC = () => {
  const { detectedWallets, activeWallet, isDetecting } = useBridgeWallets()

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h4 className="font-bold mb-2">🔍 Wallet Debug Info</h4>

      <div className="mb-2">
        <strong>Detecting:</strong> {isDetecting ? "Yes" : "No"}
      </div>

      <div className="mb-2">
        <strong>Detected ({detectedWallets.length}):</strong>
        <ul className="ml-2">
          {detectedWallets.map((wallet, i) => (
            <li key={i} className="text-gray-300">
              • {wallet.name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <strong>Active:</strong>{" "}
        <span className={activeWallet ? "text-green-400" : "text-red-400"}>
          {activeWallet?.name || "None"}
        </span>
      </div>
    </div>
  )
}

export default WalletDebugInfo

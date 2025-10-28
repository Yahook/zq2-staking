import Head from "next/head"
import { useState } from "react"
import Image from "next/image"
import logoUrl from "../assets/svgs/logo.svg"
import { Button } from "antd"
import { AppConfigStorage } from "@/contexts/appConfigStorage"
import { useRouter } from "next/router"

const PreviewAuthentication = () => {
  const { isPreviewAuthenticated, tryPreviewAuthentication } =
    AppConfigStorage.useContainer()
  const [userPassword, setUserPassword] = useState("")

  const { push } = useRouter()

  // Only redirect on client side
  if (typeof window !== "undefined" && isPreviewAuthenticated) {
    push("/")
  }

  return (
    <>
      <Head>
        <title>Coming Soon | Zilliqa Staking</title>
        <meta name="description" content="Zilliqa Staking is launching soon!" />
      </Head>
      <div className="min-h-screen flex flex-col justify-between text-white px-4 relative overflow-hidden">
        {/* Logo at the top */}
        <div className="w-full flex justify-center pt-8 pb-4">
          <Image
            src={logoUrl}
            alt="Logo"
            width={192}
            height={64}
            className="mx-auto"
          />
        </div>
        {/* Centered content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <h3 className="text-4xl md:text-5xl font-extrabold mb-4 text-center">
            {" "}
            Authenticate to preview
          </h3>

          {/* text input */}
          {/* TODO */}
          <input
            type="password"
            placeholder="Enter password"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            className="w-full max-w-md px-4 py-2 mb-6 text-lg rounded-full bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors duration-200"
          />

          <Button
            type="primary"
            className="btn-primary-teal px-10 py-2 text-lg font-bold rounded-full shadow-lg transition-transform duration-200 hover:scale-105"
            onClick={() => tryPreviewAuthentication(userPassword)}
          >
            Log in
          </Button>
        </div>
        {/* Footer at the bottom */}
        <footer className="w-full text-gray-500 text-sm text-center py-6">
          &copy; {new Date().getFullYear()} Zilliqa Staking
        </footer>
      </div>
    </>
  )
}

export default PreviewAuthentication

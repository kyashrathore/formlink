import {
  APP_DESCRIPTION,
  APP_NAME,
  getFormFillerFBasePath,
} from "@/app/lib/config"
import { Toaster } from "@formlink/ui"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import "@formlink/ui/globals.css"
import "./view-transitions.css"
import { FeedbackBubble } from "@/app/components/FeedbackBubble"
import {
  PostHogPageview,
  PostHogProviderWrapper,
} from "@/app/providers/posthog-provider"
import { ReactQueryClientProvider } from "@/app/ReactQueryClientProvider"
import { getenv } from "@/lib/env"
import { Inter, Poppins } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "Formlink.ai - Conversational Form Builder",
    template: "%s | Formlink.ai",
  },
  description:
    "Build advanced forms through simple conversation with AI. Create powerful, intelligent forms in seconds without coding.",
  metadataBase: new URL("https://formlink.ai"),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isDev = getenv("NODE_ENV") === "development"
  const formlinkFBasepath = getFormFillerFBasePath()

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${poppins.variable} scroll-smooth antialiased`}
      >
        <PostHogProviderWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <ReactQueryClientProvider>
              <Toaster position="top-center" />
              <Suspense fallback={null}>
                <PostHogPageview />
              </Suspense>
              {children}
              <FeedbackBubble />
            </ReactQueryClientProvider>
          </ThemeProvider>
        </PostHogProviderWrapper>
        <Script src={`${formlinkFBasepath}/embed/v1.js`} defer />
      </body>
    </html>
  )
}

import { FeedbackBubble } from "@/app/components/FeedbackBubble"
import { getEmbedScriptsBasePath } from "@/app/lib/config"
import {
  PostHogPageview,
  PostHogProviderWrapper,
} from "@/app/providers/posthog-provider"
import { ReactQueryClientProvider } from "@/app/ReactQueryClientProvider"
import { Toaster } from "@formlink/ui"
import "@formlink/ui/globals.css"
import "./styles/vars.css"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Inter, Poppins } from "next/font/google"
import Script from "next/script"
import { Suspense } from "react"
import "./styles/vars.css"
import "./view-transitions.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Formlink.ai - Conversational Form Builder",
    template: "%s | Formlink.ai",
  },
  description:
    "Build advanced forms through simple conversation with AI. Create powerful, intelligent forms in seconds without coding.",
  metadataBase: new URL("https://formlink.ai"),
  alternates: {
    canonical: "https://formlink.ai",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const embedScriptsBasePath = getEmbedScriptsBasePath()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} scroll-smooth antialiased`}
      >
        <PostHogProviderWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
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
        <Script src={`${embedScriptsBasePath}/embed/v1.js`} defer />
      </body>
    </html>
  )
}

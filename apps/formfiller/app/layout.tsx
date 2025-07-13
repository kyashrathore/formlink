import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@formlink/ui/globals.css";
import { ThemeProvider } from "next-themes";
import DarkModeToggle from "@/components/DarkModeToggle";
import {
  PostHogProviderWrapper,
  PostHogPageview,
} from "@/app/providers/posthog-provider";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Create Forms by Chatting - No Coding or Drag-and-Drop Needed.",
  description:
    "Build forms effortlessly by chatting with AI. Formlink.ai is the best form builder - no coding or drag-and-drop needed. Create forms in seconds.",
  keywords: [
    "form builder",
    "AI form builder",
    "chat forms",
    "no-code forms",
    "formlink",
    "formlink",
  ],
  metadataBase: new URL("https://formlink.ai"),
  openGraph: {
    title: "Create Forms by Chatting - No Coding or Drag-and-Drop Needed.",
    description:
      "Build forms effortlessly by chatting with AI. Formlink.ai is the best form builder - no coding or drag-and-drop needed. Create forms in seconds.",
    url: "https://formlink.ai",
    siteName: "Formfiller",
    images: [
      {
        url: "/formlink-logo.png",
        width: 512,
        height: 512,
        alt: "Formfiller Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Forms by Chatting - No Coding or Drag-and-Drop Needed.",
    description:
      "Build forms effortlessly by chatting with AI. Formlink.ai is the best form builder - no coding or drag-and-drop needed. Create forms in seconds.",
    site: "@formlinkai",
    images: [
      {
        url: "/formlink-logo.png",
        width: 512,
        height: 512,
        alt: "Formfiller Logo",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={inter.className}>
        <PostHogProviderWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
            <div className="flex justify-end p-4">
              <DarkModeToggle />
            </div>
            <div className="h-[calc(100dvh-64px)]">{children}</div>
          </ThemeProvider>
        </PostHogProviderWrapper>
      </body>
    </html>
  );
}

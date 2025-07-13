import { ErrorBoundary } from "@/app/components/ErrorBoundary"
import { ComparisonSection } from "@/app/components/landing/ComparisonSection"
import { FaqSection } from "@/app/components/landing/faq-section"
import { FeaturesSection } from "@/app/components/landing/FeaturesSection"
import { Footer } from "@/app/components/landing/footer"
import { HeroWithLiveDemo } from "@/app/components/landing/hero-with-live-demo"
import { HowItWorksSection } from "@/app/components/landing/HowItWorksSection"
import { Navigation } from "@/app/components/landing/navigation"
import { PricingSection } from "@/app/components/landing/PricingSection"
import { WhoIsItForSection } from "@/app/components/landing/WhoIsItForSection"
import { Metadata } from "next"
import ClientBody from "./ClientBody"

export const metadata: Metadata = {
  title: "Formlink.ai - Build Advanced Forms by Simply Talking to AI",
  description:
    "Create powerful forms in seconds through natural conversation. No coding, no drag-and-drop - just describe what you need and watch AI build it instantly. Free forever.",
  keywords: [
    "form builder",
    "AI forms",
    "conversational form builder",
    "online forms",
    "form creation",
    "no-code forms",
  ],
  openGraph: {
    title: "Formlink.ai - Build Advanced Forms by Simply Talking to AI",
    description:
      "Create powerful forms in seconds through natural conversation. No coding, no drag-and-drop - just describe what you need and watch AI build it instantly.",
    url: "https://formlink.ai",
    siteName: "Formlink.ai",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Formlink.ai - Conversational Form Builder",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Formlink.ai - Build Forms with AI",
    description:
      "Create powerful forms in seconds through natural conversation. Free forever.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function Home() {
  return (
    <ClientBody>
      <main className="min-h-screen">
        <Navigation />
        <ErrorBoundary section="hero">
          <HeroWithLiveDemo />
        </ErrorBoundary>
        <ErrorBoundary section="comparison">
          <ComparisonSection />
        </ErrorBoundary>
        <ErrorBoundary section="features">
          <FeaturesSection />
        </ErrorBoundary>
        <ErrorBoundary section="how it works">
          <HowItWorksSection />
        </ErrorBoundary>
        <ErrorBoundary section="use cases">
          <WhoIsItForSection />
        </ErrorBoundary>
        <ErrorBoundary section="pricing">
          <PricingSection />
        </ErrorBoundary>
        <ErrorBoundary section="FAQ">
          <FaqSection />
        </ErrorBoundary>
        <Footer />
      </main>
    </ClientBody>
  )
}

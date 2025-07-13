"use client"

import { signInWithGoogle } from "@/app/lib/api"
import { APP_NAME } from "@/app/lib/config"
import { createBrowserClient } from "@formlink/db"
import { Button } from "@formlink/ui"
import Link from "next/link"
import posthog from "posthog-js"
import { useState } from "react"
import { HeaderGoBack } from "../components/header-go-back"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient()

  async function handleSignInWithGoogle() {
    try {
      setIsLoading(true)
      setError(null)

      // Track login attempt
      posthog.capture("login_attempted", {
        method: "google",
        referrer: document.referrer,
      })

      const data = await signInWithGoogle(supabase)

      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      console.error("Error signing in with Google:", err)
      setError(err.message || "An unexpected error occurred. Please try again.")

      // Track login error
      posthog.capture("login_failed", {
        method: "google",
        error: err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Welcome to {APP_NAME}
            </h1>
            <p className="text-muted-foreground mt-3">
              Sign in get exclusive access to beta.
            </p>
          </div>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <div className="mt-8">
            <Button
              variant="secondary"
              className="w-full text-base sm:text-base"
              size="lg"
              onClick={handleSignInWithGoogle}
              disabled={isLoading}
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google logo"
                width={20}
                height={20}
                className="mr-2 size-4"
              />
              <span>
                {isLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </Button>
          </div>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        {}
        <p>
          By continuing, you agree to our{" "}
          <Link href="/dashboard" className="text-foreground hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/dashboard" className="text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}

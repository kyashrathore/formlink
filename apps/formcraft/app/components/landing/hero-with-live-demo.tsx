"use client"

import { MODEL_DEFAULT } from "@/app/lib/config"
import { getTurnstileSiteKey, isLocalhost } from "@/app/lib/utils/env"
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { createBrowserClient } from "@formlink/db"
import { useRouter } from "next/navigation"
import Script from "next/script"
import React, { useEffect, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useAuth } from "../../hooks/useAuth"
import { InlineChatInput } from "./InlineChatInput"
import { PromptSuggestions } from "./PromptSuggestions"

// Declare global turnstile
declare global {
  interface Window {
    turnstile: any
  }
}

export function HeroWithLiveDemo() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const formIdRef = useRef<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(
    null
  )
  const [showTurnstile, setShowTurnstile] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient()
  const [inputValue, setInputValue] = useState("")

  // Get the form store actions
  const { setInitialPrompt } = useFormAgentStore()

  // Monitor auth state changes
  useEffect(() => {
    // Auth state changed
  }, [user, loading, isSigningIn])

  // Focus input after loading is complete
  useEffect(() => {
    if (!loading) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const textarea = document.querySelector("textarea")
        if (
          textarea &&
          !document.activeElement?.tagName?.toLowerCase().includes("input")
        ) {
          ;(textarea as HTMLTextAreaElement).focus()
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Initialize Turnstile when script loads
  useEffect(() => {
    const initializeTurnstile = () => {
      if (
        typeof window !== "undefined" &&
        window.turnstile &&
        turnstileRef.current &&
        !user &&
        !turnstileWidgetId
      ) {
        setTurnstileToken(null)

        try {
          const siteKey = getTurnstileSiteKey()

          // Turnstile configuration check

          if (!siteKey) {
            // Turnstile site key is not configured
            // Set a flag to indicate Turnstile is not available
            setTurnstileToken("TURNSTILE_NOT_CONFIGURED")
            return
          }

          // Try with minimal configuration first
          const widgetId = window.turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              // Turnstile token received
              setTurnstileToken(token)
              ;(window as any).__turnstileToken = token
              // Hide widget after successful verification
              setShowTurnstile(false)
            },
            "error-callback": (errorCode: string) => {
              // Turnstile error callback
              setTurnstileToken(null)
              ;(window as any).__turnstileToken = null
              setShowTurnstile(false)
            },
            "expired-callback": () => {
              // Turnstile token expired
              setTurnstileToken(null)
              ;(window as any).__turnstileToken = null
            },
            refresh: "manual",
            execution: "render",
          })

          // Turnstile widget rendered
          setTurnstileWidgetId(widgetId)
        } catch (error) {
          // Failed to initialize Turnstile
          // Try to continue without Turnstile in case of error
          setTurnstileToken("INIT_ERROR")
        }
      }
    }

    initializeTurnstile()

    const checkInterval = setInterval(() => {
      if (window.turnstile && !turnstileWidgetId) {
        initializeTurnstile()
        clearInterval(checkInterval)
      }
    }, 500)

    return () => clearInterval(checkInterval)
  }, [user, turnstileWidgetId])

  const handleStartCreating = async (prompt: string) => {
    if (isSigningIn || !prompt.trim()) return

    // Store the prompt in the store
    setInitialPrompt(prompt)

    if (user) {
      // For logged-in users, redirect to form editor
      if (!formIdRef.current) {
        formIdRef.current = uuidv4()
      }
      // Clear the input after redirect
      setInputValue("")
      // Pass the prompt as a query parameter
      const params = new URLSearchParams({ prompt: prompt })
      router.push(`/dashboard/forms/${formIdRef.current}?${params.toString()}`)
    } else {
      // For guests, sign in anonymously first
      setIsSigningIn(true)

      // Trigger Turnstile challenge if not already completed
      let captchaToken = turnstileToken

      // Check if Turnstile is not configured or had initialization error
      if (
        captchaToken === "TURNSTILE_NOT_CONFIGURED" ||
        captchaToken === "INIT_ERROR"
      ) {
        // Proceeding without Turnstile due to configuration/initialization issues
        // Set captchaToken to null to proceed without it
        captchaToken = null
      }

      if (!captchaToken && window.turnstile && turnstileWidgetId) {
        ;(window as any).__turnstileToken = null

        // Show the widget when executing
        setShowTurnstile(true)

        // Since we're using "normal" size, we need to reset and execute
        try {
          window.turnstile.reset(turnstileWidgetId)
          // Widget will appear automatically due to execution: "render"
        } catch (executeError) {
          // Failed to reset Turnstile
          setShowTurnstile(false)
        }

        // Wait for token
        captchaToken = await new Promise<string | null>((resolve) => {
          let attempts = 0
          const checkToken = setInterval(() => {
            attempts++
            const currentToken = (window as any).__turnstileToken
            if (currentToken || attempts > 100) {
              clearInterval(checkToken)
              resolve(currentToken || null)
            }
          }, 100)
        })

        if (captchaToken) {
          setTurnstileToken(captchaToken)
        }
      }

      try {
        // Attempting anonymous sign-in

        const { data, error } = await supabase.auth.signInAnonymously({
          options: {
            captchaToken: captchaToken || undefined,
          },
        })

        if (error) {
          // Anonymous sign-in failed
          if (error.message?.includes("captcha")) {
            if (isLocalhost()) {
              alert(
                "CAPTCHA verification failed. Make sure Supabase local is running."
              )
            } else {
              // Production error
              // Turnstile verification failed in production

              // Check for specific error types
              if (
                error.message?.includes("405") ||
                error.message?.includes("Method Not Allowed")
              ) {
                // 405 Error: The domain might not be configured in Cloudflare Turnstile
                alert(
                  "Security verification configuration error. The domain may not be properly configured. Please contact support."
                )
              } else {
                alert(
                  "Security verification failed. Please refresh the page and try again. If the problem persists, please contact support."
                )
              }
            }
          } else {
            alert(
              "Failed to start your session. Please refresh the page and try again."
            )
          }
          return
        }

        if (data.user) {
          // Anonymous sign-in successful, creating user record

          // Check localStorage for existing anonymous session
          const existingAnonymousId = localStorage.getItem("anonymous_user_id")
          let userCreationSkipped = false

          if (existingAnonymousId === data.user.id) {
            // Skip user creation, we know this user exists
            userCreationSkipped = true
          } else {
            // Try to create user record in the database
            // First, let's check if the user already exists
            const { data: existingUser, error: checkError } = await supabase
              .from("users")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle()

            if (checkError && checkError.code !== "42501") {
              // Error checking existing user
            }

            if (!existingUser && !checkError) {
              // User doesn't exist, try to create it
              const { error: userError } = await supabase.from("users").insert({
                id: data.user.id,
                email: data.user.email || `${data.user.id}@anonymous.local`,
                anonymous: true,
                premium: false,
                message_count: 0,
                created_at: new Date().toISOString(),
                preferred_model: MODEL_DEFAULT,
              })

              if (userError) {
                // Error creating user record

                // Check if it's a duplicate key error
                if (userError.code === "23505") {
                  // User already exists, continuing
                  // User already exists, which is fine
                } else if (userError.code === "42501") {
                  // RLS policy violation - this is expected for anonymous users
                  // RLS prevents user creation, but auth is successful. Continuing
                  userCreationSkipped = true
                } else {
                  // Unexpected error creating user record. Continuing anyway
                  userCreationSkipped = true
                }
              } else {
                // User record created successfully
                // Store the anonymous user ID for future visits
                localStorage.setItem("anonymous_user_id", data.user.id)
              }
            } else if (existingUser) {
              // User already exists, continuing
              // Store the anonymous user ID for future visits
              localStorage.setItem("anonymous_user_id", data.user.id)
            } else if (checkError?.code === "42501") {
              // RLS prevents checking user existence, continuing
              userCreationSkipped = true
            }
          }

          // Skip verification if user creation was skipped due to RLS
          if (!userCreationSkipped) {
            // Try to verify user record was created
            const { data: userRecord, error: verifyError } = await supabase
              .from("users")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle()

            if (verifyError?.code === "42501") {
              // RLS prevents reading user record, but auth is successful
            } else if (verifyError) {
              // Unexpected error verifying user record
            } else if (userRecord) {
              // User record verified successfully
            }
          }

          // Generate a form ID and redirect to form editor
          if (!formIdRef.current) {
            formIdRef.current = uuidv4()
          }

          // Redirecting to form editor

          // Clear the input after successful redirect
          setInputValue("")

          // Redirect to form editor with prompt as query parameter
          const params = new URLSearchParams({ prompt: prompt })
          router.push(
            `/dashboard/forms/${formIdRef.current}?${params.toString()}`
          )
        }
      } catch (error) {
        // Error during anonymous sign-in
      } finally {
        setIsSigningIn(false)
      }
    }
  }

  // Default hero section
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />

      <section className="overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="container-custom">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              Build Advanced Forms by Simply Talking to AI.
            </h1>

            <p className="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
              Forget complicated form builders. Just tell us what kind of form
              you want, and our AI will make it for you—fast and easy, no coding
              or dragging things around.
            </p>

            <div className="mt-12">
              <InlineChatInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleStartCreating}
                disabled={loading || isSigningIn}
              />
            </div>

            <div className="mt-8">
              <PromptSuggestions
                onSelectPrompt={(prompt) => {
                  setInputValue(prompt)
                  // Auto-focus the input
                  setTimeout(() => {
                    const textarea = document.querySelector("textarea")
                    textarea?.focus()
                  }, 100)
                }}
              />
            </div>

            {/* Turnstile widget container */}
            <div
              ref={turnstileRef}
              style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                zIndex: 9999,
                display: showTurnstile ? "block" : "none",
              }}
            />
          </div>
        </div>
      </section>
    </>
  )
}

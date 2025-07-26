"use client"

import { MODEL_DEFAULT } from "@/app/lib/config"
import { getTurnstileSiteKey, isLocalhost } from "@/app/lib/utils/env"
import { useFormAgentStore } from "@/app/stores/formAgentStore"
import { createBrowserClient } from "@formlink/db"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { useEffect, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { useAuth } from "../../hooks/useAuth"
import { InlineChatInput } from "./InlineChatInput"
import { PromptSuggestions } from "./PromptSuggestions"

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

  const { setInitialPrompt } = useFormAgentStore()

  useEffect(() => {}, [user, loading, isSigningIn])

  useEffect(() => {
    if (!loading) {
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

          if (!siteKey) {
            setTurnstileToken("TURNSTILE_NOT_CONFIGURED")
            return
          }

          const widgetId = window.turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              setTurnstileToken(token)
              ;(window as any).__turnstileToken = token

              setShowTurnstile(false)
            },
            "error-callback": (_errorCode: string) => {
              console.error("Turnstile error callback triggered", _errorCode)
              setTurnstileToken(null)
              ;(window as any).__turnstileToken = null
              setShowTurnstile(false)
            },
            "expired-callback": () => {
              setTurnstileToken(null)
              ;(window as any).__turnstileToken = null
            },
            refresh: "manual",
            execution: "render",
          })

          setTurnstileWidgetId(widgetId)
        } catch (_error) {
          console.error("Failed to initialize Turnstile", _error)
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

    setInitialPrompt(prompt)

    if (user) {
      if (!formIdRef.current) {
        formIdRef.current = uuidv4()
      }

      setInputValue("")

      const params = new URLSearchParams({ prompt: prompt })
      router.push(`/dashboard/forms/${formIdRef.current}?${params.toString()}`)
    } else {
      setIsSigningIn(true)

      let captchaToken = turnstileToken

      if (
        captchaToken === "TURNSTILE_NOT_CONFIGURED" ||
        captchaToken === "INIT_ERROR"
      ) {
        captchaToken = null
      }

      if (!captchaToken && window.turnstile && turnstileWidgetId) {
        ;(window as any).__turnstileToken = null

        setShowTurnstile(true)

        try {
          window.turnstile.reset(turnstileWidgetId)
        } catch (_executeError) {
          console.error("Failed to reset Turnstile widget", _executeError)
          setShowTurnstile(false)
        }

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
        const { data, error } = await supabase.auth.signInAnonymously({
          options: {
            captchaToken: captchaToken || undefined,
          },
        })

        if (error) {
          if (error.message?.includes("captcha")) {
            if (isLocalhost()) {
              alert(
                "CAPTCHA verification failed. Make sure Supabase local is running."
              )
            } else {
              if (
                error.message?.includes("405") ||
                error.message?.includes("Method Not Allowed")
              ) {
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
          const existingAnonymousId = localStorage.getItem("anonymous_user_id")
          let userCreationSkipped = false

          if (existingAnonymousId === data.user.id) {
            userCreationSkipped = true
          } else {
            const { data: existingUser, error: checkError } = await supabase
              .from("users")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle()

            if (checkError && checkError.code !== "42501") {
            }

            if (!existingUser && !checkError) {
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
                if (userError.code === "23505") {
                } else if (userError.code === "42501") {
                  userCreationSkipped = true
                } else {
                  userCreationSkipped = true
                }
              } else {
                localStorage.setItem("anonymous_user_id", data.user.id)
              }
            } else if (existingUser) {
              localStorage.setItem("anonymous_user_id", data.user.id)
            } else if (checkError?.code === "42501") {
              userCreationSkipped = true
            }
          }

          if (!userCreationSkipped) {
            const { data: userRecord, error: verifyError } = await supabase
              .from("users")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle()

            if (verifyError?.code === "42501") {
            } else if (verifyError) {
            } else if (userRecord) {
            }
          }

          if (!formIdRef.current) {
            formIdRef.current = uuidv4()
          }

          setInputValue("")

          const params = new URLSearchParams({ prompt: prompt })
          router.push(
            `/dashboard/forms/${formIdRef.current}?${params.toString()}`
          )
        }
      } catch (_error) {
        console.error("Error signing in anonymously", _error)
      } finally {
        setIsSigningIn(false)
      }
    }
  }

  return (
    <>
      <Script
        src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"
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

                  setTimeout(() => {
                    const textarea = document.querySelector("textarea")
                    textarea?.focus()
                  }, 100)
                }}
              />
            </div>

            {}
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

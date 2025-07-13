import { head, put } from "@vercel/blob"
import { ImageResponse } from "next/og"
import type React from "react"
import { getBlogPostBySlug, updateOgImageUrl } from "../../../lib/notion"
import { generateSVGVisual } from "./generateSvgVisual"

export const revalidate = 60

const FallbackSVGVisual = () => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 800 1080"
    style={{ display: "flex" }}
  >
    <defs>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <g transform="translate(400, 540)">
      <circle
        cx="0"
        cy="0"
        r="120"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.3"
      />
      <circle
        cx="0"
        cy="0"
        r="180"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.2"
      />
      <circle
        cx="0"
        cy="0"
        r="240"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.15"
      />
      <circle cx="0" cy="-120" r="4" fill="#ffffff" opacity="0.8" />
      <circle cx="85" cy="85" r="3" fill="#ffffff" opacity="0.6" />
      <circle cx="-85" cy="85" r="3" fill="#ffffff" opacity="0.6" />
      <circle cx="0" cy="180" r="2" fill="#ffffff" opacity="0.4" />
      <path
        d="M 0,-120 Q 60,-60 85,85"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.3"
      />
      <path
        d="M 85,85 Q 0,120 -85,85"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.3"
      />
      <path
        d="M -85,85 Q -60,-60 0,-120"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.3"
      />
      <g opacity="0.2">
        <line
          x1="0"
          y1="-300"
          x2="0"
          y2="-260"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="150"
          y1="-260"
          x2="130"
          y2="-225"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="260"
          y1="0"
          x2="225"
          y2="0"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="150"
          y1="260"
          x2="130"
          y2="225"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="-150"
          y1="260"
          x2="-130"
          y2="-225"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="-260"
          y1="0"
          x2="-225"
          y2="0"
          stroke="#ffffff"
          strokeWidth="1"
        />
        <line
          x1="-150"
          y1="-260"
          x2="-130"
          y2="-225"
          stroke="#ffffff"
          strokeWidth="1"
        />
      </g>
    </g>
    <g transform="translate(200, 200)" opacity="0.15">
      <rect x="0" y="0" width="60" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="20" width="40" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="40" width="80" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="70" width="50" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="90" width="70" height="8" fill="#ffffff" rx="4" />
    </g>
    <g transform="translate(500, 750)" opacity="0.15">
      <rect x="0" y="0" width="45" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="20" width="65" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="40" width="35" height="8" fill="#ffffff" rx="4" />
      <rect x="0" y="70" width="55" height="8" fill="#ffffff" rx="4" />
    </g>
    <circle cx="400" cy="540" r="300" fill="url(#centerGlow)" />
  </svg>
)

interface BlogCoverProps {
  title: string
  description: string
  svgVisual?: React.ReactNode
}

// REFACTORED BlogCover Component to use Flexbox exclusively
function BlogCover({ title, description, svgVisual }: BlogCoverProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        backgroundColor: "black",
        color: "white",
        fontFamily: '"Inter"',
        padding: 80,
      }}
    >
      {/* Main container for the two columns */}
      <div style={{ display: "flex", width: "100%" }}>
        {/* Left 60% - Text Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "60%",
            justifyContent: "space-between",
          }}
        >
          {/* CORRECTED: Top-left branding with logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg
              width={32}
              height={32}
              viewBox="0 0 30 30"
              style={{ marginRight: "12px" }} // Keep the margin here
            >
              <path
                // The fill attribute MUST be on the path itself
                fill="#71717a"
                d="M8.695 6.006c-0.106 0.082 -0.161 0.217 -0.228 0.548 -0.147 0.733 -0.419 1.239 -0.832 1.553 -0.323 0.24 -0.589 0.34 -1.195 0.451 -0.182 0.035 -0.366 0.079 -0.408 0.103 -0.261 0.135 -0.269 0.489 -0.015 0.609 0.056 0.027 0.246 0.073 0.422 0.106 0.393 0.07 0.642 0.147 0.876 0.273 0.595 0.311 0.943 0.814 1.113 1.6 0.12 0.548 0.126 0.566 0.243 0.683q0.207 0.205 0.404 0.038c0.114 -0.094 0.164 -0.228 0.238 -0.621 0.238 -1.254 0.791 -1.788 2.074 -2.001 0.323 -0.053 0.478 -0.182 0.478 -0.404 0 -0.068 -0.029 -0.126 -0.094 -0.197 -0.094 -0.1 -0.118 -0.108 -0.592 -0.205 -0.41 -0.085 -0.545 -0.126 -0.773 -0.238 -0.592 -0.288 -0.947 -0.823 -1.122 -1.699a2.5 2.5 0 0 0 -0.123 -0.445c-0.094 -0.202 -0.313 -0.273 -0.466 -0.153m4.078 3.682c-0.663 0.047 -1.225 0.302 -1.72 0.779 -0.598 0.574 -0.858 1.237 -0.82 2.078 0.05 1.198 0.832 2.136 2.051 2.464l0.24 0.064h8.789l0.263 -0.068c0.348 -0.085 0.853 -0.34 1.116 -0.559a2.666 2.666 0 0 0 0.953 -1.647 3.34 3.34 0 0 0 -0.062 -1.125 2.708 2.708 0 0 0 -2.358 -1.978c-0.29 -0.027 -8.08 -0.035 -8.453 -0.009m-0.557 6.147c-1.019 0.211 -1.808 0.984 -2.007 1.966 -0.041 0.205 -0.047 0.457 -0.038 2.007 0.012 1.732 0.012 1.775 0.076 1.983 0.143 0.469 0.34 0.783 0.715 1.134 0.184 0.176 0.299 0.252 0.533 0.366 0.431 0.208 0.598 0.246 1.102 0.246 0.545 0.003 0.891 -0.088 1.307 -0.337 0.744 -0.451 1.16 -1.207 1.166 -2.127l0.003 -0.358 1.172 -0.009c1.098 -0.012 1.187 -0.018 1.407 -0.076 0.893 -0.246 1.585 -0.92 1.823 -1.769 0.079 -0.288 0.07 -0.905 -0.015 -1.21 -0.24 -0.844 -0.885 -1.485 -1.782 -1.763l-0.261 -0.082 -2.505 -0.006c-2.007 -0.003 -2.543 0.003 -2.695 0.035"
              />
            </svg>
            <span style={{ color: "#71717a", fontWeight: "500", fontSize: 24 }}>
              FormLink.ai
            </span>
          </div>

          {/* Vertically centered main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flexGrow: 1,
              paddingBottom: 60,
            }}
          >
            <h1
              style={{
                fontSize: 56,
                fontWeight: "bold",
                lineHeight: 1.1,
                marginBottom: 24,
                maxWidth: "90%",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 20,
                color: "#a1a1aa",
                lineHeight: 1.2,
                maxWidth: "85%",
              }}
            >
              {description}
            </p>
          </div>

          <div style={{ display: "flex" }}></div>
        </div>

        {/* Right 40% - SVG Visual */}
        <div
          style={{
            display: "flex",
            width: "40%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {svgVisual}
          </div>
        </div>
      </div>
    </div>
  )
}

// This is the main updated function
export default async function OpenGraphImage({
  params,
}: {
  params: { slug: string }
}) {
  // Define a unique pathname for the image in Vercel Blob
  const blobPathname = `og/${params.slug}.png`

  try {
    // 1. CHECK: Attempt to retrieve the metadata of the existing blob
    const blob = await head(blobPathname)

    // 2. CACHE HIT: If it exists, redirect to its public URL
    // OG Image cache hit
    const imageData = blob.url

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
          }}
        >
          <img width="100%" height="100%" src={imageData} alt="My OG Image" />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error: Error | unknown) {
    // 3. CACHE MISS: If 'head' throws a 404, the file doesn't exist.
    if (
      error instanceof Error &&
      error.message !== "Vercel Blob: The requested blob does not exist"
    ) {
      // Re-throw any other errors (e.g., network issues)
      throw error
    }
    // OG Image cache miss - generating new image
  }

  // --- GENERATION LOGIC (runs only on cache miss) ---

  const post = await getBlogPostBySlug(params.slug)

  if (!post) {
    return new Response("Post Not Found", { status: 404 })
  }

  async function loadGoogleFont(font: string, text: string) {
    const url = `https://fonts.googleapis.com/css2?family=${font}:wght@400;500;700&text=${encodeURIComponent(
      text
    )}`
    const css = await (await fetch(url)).text()
    const fontUrl = css.match(
      /src: url\((.+)\) format\('(opentype|truetype)'\)/
    )?.[1]
    if (!fontUrl) throw new Error("Failed to load font data")
    const response = await fetch(fontUrl)
    if (response.status === 200) return await response.arrayBuffer()
    throw new Error("Failed to load font data")
  }

  const font = await loadGoogleFont("Inter", post.title + post.summary)

  let SvgComponent: React.ComponentType | null = null
  try {
    // Generating SVG visual
    SvgComponent = await generateSVGVisual({
      title: post.title,
      description: post.summary,
    })
  } catch (error) {
    // Failed to generate SVG visual
    SvgComponent = null
  }

  const svgVisual = SvgComponent ? <SvgComponent /> : <FallbackSVGVisual />

  const imageResponse = new ImageResponse(
    (
      <BlogCover
        title={post.title}
        description={post.summary}
        svgVisual={svgVisual}
      />
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: font,
          style: "normal",
        },
      ],
    }
  )

  // 4. UPLOAD: Upload the newly generated image to Vercel Blob
  // We clone the response to read its body as a buffer without consuming it
  try {
    const buffer = await imageResponse.clone().arrayBuffer()
    const blob = await put(blobPathname, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false, // Important: ensures our pathname is predictable
      allowOverwrite: true,
    })

    if (post.id) {
      await updateOgImageUrl(post.id, blob.url)
    }

    // Successfully uploaded new OG image
  } catch (uploadError) {
    // Failed to upload OG Image to Vercel Blob
    // Even if upload fails, we still serve the image to the first user
  }

  // 5. SERVE: Return the generated image to the first user
  return imageResponse
}

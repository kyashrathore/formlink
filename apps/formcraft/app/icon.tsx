import { ImageResponse } from "next/og"

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = "image/png"

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: "black",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
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
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported icons size metadata
      // config to also set the ImageResponse's width and height.
      ...size,
    }
  )
}

import "@testing-library/jest-dom"
import { TransformStream } from "stream/web"

if (typeof global.TransformStream === "undefined") {
  // Provide minimal TransformStream impl required by ai-sdk in JSDOM
  global.TransformStream = TransformStream
}

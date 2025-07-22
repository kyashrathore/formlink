import { render, screen } from "@testing-library/react"
import DevicePreviewFrame from "../DevicePreviewFrame"

describe("DevicePreviewFrame", () => {
  it("renders mobile dimensions correctly", () => {
    render(
      <DevicePreviewFrame deviceMode="mobile">
        <div data-testid="content">Test Content</div>
      </DevicePreviewFrame>
    )

    expect(screen.getByText("Mobile (375×812)")).toBeInTheDocument()
    expect(screen.getByTestId("content")).toBeInTheDocument()
  })

  it("renders tablet dimensions correctly", () => {
    render(
      <DevicePreviewFrame deviceMode="tablet">
        <div data-testid="content">Test Content</div>
      </DevicePreviewFrame>
    )

    expect(screen.getByText("Tablet (768×1024)")).toBeInTheDocument()
  })

  it("renders desktop dimensions correctly", () => {
    render(
      <DevicePreviewFrame deviceMode="desktop">
        <div data-testid="content">Test Content</div>
      </DevicePreviewFrame>
    )

    expect(screen.getByText("Desktop (1200×800)")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    const { container } = render(
      <DevicePreviewFrame deviceMode="mobile" className="custom-class">
        <div>Test Content</div>
      </DevicePreviewFrame>
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })
})

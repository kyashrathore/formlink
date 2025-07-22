import { fireEvent, render, screen } from "@testing-library/react"
import PreviewControls from "../PreviewControls"

describe("PreviewControls", () => {
  const mockOnDeviceModeChange = jest.fn()

  beforeEach(() => {
    mockOnDeviceModeChange.mockClear()
  })

  it("renders all device mode buttons", () => {
    render(
      <PreviewControls
        deviceMode="desktop"
        onDeviceModeChange={mockOnDeviceModeChange}
      />
    )

    expect(
      screen.getByLabelText("Switch to mobile preview")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Switch to tablet preview")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Switch to desktop preview")
    ).toBeInTheDocument()
  })

  it("highlights the active device mode", () => {
    render(
      <PreviewControls
        deviceMode="mobile"
        onDeviceModeChange={mockOnDeviceModeChange}
      />
    )

    const mobileButton = screen.getByLabelText("Switch to mobile preview")
    const desktopButton = screen.getByLabelText("Switch to desktop preview")

    expect(mobileButton).toHaveClass("bg-primary")
    expect(desktopButton).not.toHaveClass("bg-primary")
  })

  it("calls onDeviceModeChange when button is clicked", () => {
    render(
      <PreviewControls
        deviceMode="desktop"
        onDeviceModeChange={mockOnDeviceModeChange}
      />
    )

    const mobileButton = screen.getByLabelText("Switch to mobile preview")
    fireEvent.click(mobileButton)

    expect(mockOnDeviceModeChange).toHaveBeenCalledWith("mobile")
  })

  it("shows tooltips with keyboard shortcuts", () => {
    render(
      <PreviewControls
        deviceMode="desktop"
        onDeviceModeChange={mockOnDeviceModeChange}
      />
    )

    const mobileButton = screen.getByLabelText("Switch to mobile preview")
    expect(mobileButton).toHaveAttribute("title", "Mobile preview (Ctrl+1)")
  })
})

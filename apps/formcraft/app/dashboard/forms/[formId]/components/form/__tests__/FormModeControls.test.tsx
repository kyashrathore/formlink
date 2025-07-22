import { fireEvent, render, screen } from "@testing-library/react"
import FormModeControls, { FormMode } from "../FormModeControls"

describe("FormModeControls", () => {
  const mockOnFormModeChange = jest.fn()

  beforeEach(() => {
    mockOnFormModeChange.mockClear()
  })

  it("renders both form mode options", () => {
    render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
      />
    )

    expect(screen.getByText("Chat Mode")).toBeInTheDocument()
    expect(screen.getByText("Typeform Mode")).toBeInTheDocument()
  })

  it("highlights the active form mode", () => {
    render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
      />
    )

    const chatButton = screen.getByRole("button", {
      name: /switch to chat mode/i,
    })
    const typeformButton = screen.getByRole("button", {
      name: /switch to typeform mode/i,
    })

    // Chat mode should be active (default variant)
    expect(chatButton).toHaveClass("bg-primary")
    // Typeform mode should be inactive (outline variant)
    expect(typeformButton).not.toHaveClass("bg-primary")
  })

  it("calls onFormModeChange when clicking a different mode", () => {
    render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
      />
    )

    const typeformButton = screen.getByRole("button", {
      name: /switch to typeform mode/i,
    })
    fireEvent.click(typeformButton)

    expect(mockOnFormModeChange).toHaveBeenCalledWith("typeform")
  })

  it("does not call onFormModeChange when clicking the active mode", () => {
    render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
      />
    )

    const chatButton = screen.getByRole("button", {
      name: /switch to chat mode/i,
    })
    fireEvent.click(chatButton)

    expect(mockOnFormModeChange).toHaveBeenCalledWith("chat")
  })

  it("has proper accessibility attributes", () => {
    render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
      />
    )

    const chatButton = screen.getByRole("button", {
      name: /switch to chat mode/i,
    })
    const typeformButton = screen.getByRole("button", {
      name: /switch to typeform mode/i,
    })

    expect(chatButton).toHaveAttribute(
      "title",
      "Conversational form experience"
    )
    expect(typeformButton).toHaveAttribute("title", "Traditional form layout")
  })

  it("applies custom className", () => {
    const { container } = render(
      <FormModeControls
        formMode="chat"
        onFormModeChange={mockOnFormModeChange}
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass("custom-class")
  })
})

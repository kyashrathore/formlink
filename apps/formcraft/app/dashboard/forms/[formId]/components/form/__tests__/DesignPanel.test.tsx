import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BrandTheme, FormThemeOverrides } from "../../../lib/types/theme"
import DesignPanel from "../DesignPanel"

jest.mock("lodash.debounce", () => (fn: (...args: unknown[]) => unknown) => {
  const debouncedFn = fn as typeof fn & { cancel: jest.Mock }
  debouncedFn.cancel = jest.fn()
  return debouncedFn
})

describe("DesignPanel", () => {
  const mockBrandTheme: BrandTheme = {
    tokens: {
      colors: {
        primary: "#1e40af",
        secondary: "#64748b",
        background: "#ffffff",
      },
    },
  }

  const mockFormOverrides: FormThemeOverrides = {
    tokens: {
      colors: {
        primary: "#dc2626",
      },
    },
  }

  const defaultProps = {
    formId: "test-form-id",
    brandTheme: mockBrandTheme,
    currentFormOverrides: {},
    onThemeChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Basic Rendering", () => {
    it("should render the design panel with all key elements", () => {
      render(<DesignPanel {...defaultProps} />)

      expect(screen.getByText("Design")).toBeInTheDocument()
      expect(
        screen.getByText("Use custom theme for this form")
      ).toBeInTheDocument()
      expect(screen.getByText("Primary Color")).toBeInTheDocument()
      expect(screen.getByText("Secondary Color")).toBeInTheDocument()
      expect(screen.getByText("Background")).toBeInTheDocument()
      expect(screen.getByText("Text Color")).toBeInTheDocument()
    })

    it("should show brand theme by default", () => {
      render(<DesignPanel {...defaultProps} />)

      const customThemeToggle = screen.getByRole("switch")
      expect(customThemeToggle).not.toBeChecked()

      expect(
        screen.getByText(/This form is using your brand theme/)
      ).toBeInTheDocument()
    })

    it("should show inheritance badges correctly", () => {
      render(<DesignPanel {...defaultProps} />)

      const brandBadges = screen.getAllByText("Brand")
      expect(brandBadges.length).toBeGreaterThan(0)

      const defaultBadges = screen.getAllByText("Default")
      expect(defaultBadges.length).toBeGreaterThan(0)
    })
  })

  describe("Custom Theme Toggle", () => {
    it("should enable custom theme when toggle is activated", async () => {
      const user = userEvent.setup()
      const onThemeChange = jest.fn()

      render(<DesignPanel {...defaultProps} onThemeChange={onThemeChange} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      expect(customThemeToggle).toBeChecked()

      expect(
        screen.queryByText(/This form is using your brand theme/)
      ).not.toBeInTheDocument()

      await waitFor(() => {
        expect(onThemeChange).toHaveBeenCalled()
      })
    })

    it("should disable color inputs when custom theme is off", () => {
      render(<DesignPanel {...defaultProps} />)

      const colorInputs = screen.getAllByDisplayValue(/#[0-9a-fA-F]{6}/)
      colorInputs.forEach((input) => {
        expect(input).toBeDisabled()
      })
    })

    it("should enable color inputs when custom theme is on", async () => {
      const user = userEvent.setup()

      render(<DesignPanel {...defaultProps} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      const colorInputs = screen.getAllByDisplayValue(/#[0-9a-fA-F]{6}/)
      colorInputs.forEach((input) => {
        expect(input).not.toBeDisabled()
      })
    })
  })

  describe("Color Customization", () => {
    it("should update color when input changes", async () => {
      const user = userEvent.setup()
      const onThemeChange = jest.fn()

      render(<DesignPanel {...defaultProps} onThemeChange={onThemeChange} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      const primaryColorInput = screen.getByLabelText("primary-color")
      await user.clear(primaryColorInput)
      await user.type(primaryColorInput, "#ff0000")

      await waitFor(() => {
        expect(onThemeChange).toHaveBeenCalledWith(
          expect.objectContaining({
            tokens: expect.objectContaining({
              colors: expect.objectContaining({
                primary: "#ff0000",
              }),
            }),
          }),
          "form",
          expect.any(Number)
        )
      })
    })

    it('should show form overrides with "Form" badges', async () => {
      const user = userEvent.setup()

      render(
        <DesignPanel
          {...defaultProps}
          currentFormOverrides={mockFormOverrides}
        />
      )

      const customThemeToggle = screen.getByRole("switch")
      if (!customThemeToggle.getAttribute("aria-checked")) {
        await user.click(customThemeToggle)
      }

      expect(screen.getByText("Form")).toBeInTheDocument()
    })
  })

  describe("Reset Functionality", () => {
    it("should show reset button when custom theme is enabled", async () => {
      const user = userEvent.setup()

      render(<DesignPanel {...defaultProps} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      expect(screen.getByText("Reset")).toBeInTheDocument()
    })

    it("should reset to brand theme when reset is clicked", async () => {
      const user = userEvent.setup()
      const onThemeChange = jest.fn()

      render(<DesignPanel {...defaultProps} onThemeChange={onThemeChange} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      const resetButton = screen.getByText("Reset")
      await user.click(resetButton)

      expect(customThemeToggle).not.toBeChecked()

      await waitFor(() => {
        expect(onThemeChange).toHaveBeenCalledWith(
          expect.objectContaining({
            tokens: expect.objectContaining({
              colors: expect.objectContaining({
                primary: "#1e40af",
              }),
            }),
          }),
          "brand",
          expect.any(Number)
        )
      })
    })
  })

  describe("Theme Inheritance Information", () => {
    it("should show theme inheritance explanation when custom theme is enabled", async () => {
      const user = userEvent.setup()

      render(<DesignPanel {...defaultProps} />)

      const customThemeToggle = screen.getByRole("switch")
      await user.click(customThemeToggle)

      expect(screen.getByText("Theme Inheritance")).toBeInTheDocument()
      expect(screen.getByText("Base FormLink theme")).toBeInTheDocument()
      expect(
        screen.getByText("Your company colors and fonts")
      ).toBeInTheDocument()
      expect(
        screen.getByText("Custom overrides for this form")
      ).toBeInTheDocument()
    })

    it("should not show inheritance explanation when using brand theme", () => {
      render(<DesignPanel {...defaultProps} />)

      expect(screen.queryByText("Theme Inheritance")).not.toBeInTheDocument()
    })
  })

  describe("Development Debug Info", () => {
    const originalEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalEnv
    })

    it("should show debug info in development mode", () => {
      process.env.NODE_ENV = "development"

      render(<DesignPanel {...defaultProps} />)

      expect(screen.getByText("Debug Info")).toBeInTheDocument()
      expect(screen.getByText(/Theme Version:/)).toBeInTheDocument()
      expect(screen.getByText(/Custom Theme:/)).toBeInTheDocument()
    })

    it("should not show debug info in production mode", () => {
      process.env.NODE_ENV = "production"

      render(<DesignPanel {...defaultProps} />)

      expect(screen.queryByText("Debug Info")).not.toBeInTheDocument()
    })
  })
})

import React from "react";
import { render, screen } from "@testing-library/react";
import { UnifiedFormInput } from "../UnifiedFormInput";

describe("UnifiedFormInput Basic Tests", () => {
  const mockProps = {
    value: "test value",
    onChange: jest.fn(),
    onSubmit: jest.fn(),
  };

  test("renders chat text input correctly", () => {
    render(<UnifiedFormInput mode="chat" type="text" {...mockProps} />);

    // Chat text input shows instruction message, not actual input
    expect(
      screen.getByText(/Type your answer in the message field below/),
    ).toBeInTheDocument();
    expect(screen.getByText("Current answer:")).toBeInTheDocument();
    expect(screen.getByText("test value")).toBeInTheDocument();
  });

  test("renders typeform text input correctly", () => {
    render(<UnifiedFormInput mode="typeform" type="text" {...mockProps} />);

    // TypeForm text input shows actual input field
    const input = screen.getByDisplayValue("test value");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  test("renders chat select correctly", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ];

    render(
      <UnifiedFormInput
        mode="chat"
        type="select"
        options={options}
        {...mockProps}
        value="option1"
      />,
    );

    // Chat select renders as button elements with option text
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  test("renders typeform select correctly", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ];

    render(
      <UnifiedFormInput
        mode="typeform"
        type="select"
        options={options}
        {...mockProps}
        value="option1"
      />,
    );

    // TypeForm select renders as card-style buttons
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    // Should have letter shortcuts A, B
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  test("handles unsupported type gracefully", () => {
    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<UnifiedFormInput mode="chat" type="invalid-type" {...mockProps} />);

    expect(screen.getByText(/Unsupported component/)).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(
      "No component found for mode: chat, type: invalid-type",
    );

    consoleSpy.mockRestore();
  });

  test("preserves current behavior exactly", () => {
    // This test ensures we don't break any existing functionality

    // Chat mode text input behavior - shows message, no input field
    const { rerender } = render(
      <UnifiedFormInput mode="chat" type="text" {...mockProps} />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Type your answer/)).toBeInTheDocument();

    // TypeForm mode text input behavior - shows input field
    rerender(<UnifiedFormInput mode="typeform" type="text" {...mockProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  test("maps type aliases correctly", () => {
    // Test that multipleChoice maps to multiselect behavior
    const options = [{ value: "opt1", label: "Option 1" }];

    const { rerender } = render(
      <UnifiedFormInput
        mode="chat"
        type="multipleChoice"
        options={options}
        {...mockProps}
        value={[]}
      />,
    );

    // Should render multiselect component (checkboxes in chat mode)
    expect(screen.getByText("Option 1")).toBeInTheDocument();

    // Test fileUpload alias with proper null value for file uploads
    rerender(
      <UnifiedFormInput
        mode="chat"
        type="fileUpload"
        value={null}
        onChange={mockProps.onChange}
        onSubmit={mockProps.onSubmit}
      />,
    );

    // Should render file upload component
    expect(screen.getByText(/Upload/)).toBeInTheDocument();
  });

  test("preserves all current props and behavior", () => {
    const customProps = {
      ...mockProps,
      placeholder: "Custom placeholder",
      disabled: true,
      required: true,
      maxLength: 100,
    };

    render(<UnifiedFormInput mode="typeform" type="text" {...customProps} />);

    const input = screen.getByDisplayValue("test value");
    expect(input).toHaveAttribute("placeholder", "Custom placeholder");
    expect(input).toBeDisabled();
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("maxLength", "100");
  });
});

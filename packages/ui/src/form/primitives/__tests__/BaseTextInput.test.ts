import { renderHook, act } from "@testing-library/react";
import { BaseTextInput } from "../BaseTextInput";

describe("BaseTextInput with behavior flag", () => {
  it("should NOT auto-submit on Enter when autoSubmitOnChange is false", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseTextInput({
        value: "test value",
        onChange,
        onSubmit,
        autoSubmitOnChange: false, // New prop
      }),
    );

    // Simulate Enter key press
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    act(() => {
      result.current.inputProps.onKeyDown?.(event as any);
    });

    expect(onSubmit).not.toHaveBeenCalled(); // Key assertion
  });

  it("should auto-submit on Enter when autoSubmitOnChange is true (default)", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseTextInput({
        value: "test value",
        onChange,
        onSubmit,
        // autoSubmitOnChange defaults to true
      }),
    );

    // Simulate Enter key press
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    act(() => {
      result.current.inputProps.onKeyDown?.(event as any);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should maintain backward compatibility when prop is not specified", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseTextInput({
        value: "test value",
        onChange,
        onSubmit,
        // autoSubmitOnChange not specified - should default to true
      }),
    );

    // Simulate Enter key press
    const event = new KeyboardEvent("keydown", { key: "Enter" });
    act(() => {
      result.current.inputProps.onKeyDown?.(event as any);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1); // Should still auto-submit by default
  });

  it("should not submit on Enter when no onSubmit callback is provided", () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseTextInput({
        value: "test value",
        onChange,
        // No onSubmit provided
        autoSubmitOnChange: true,
      }),
    );

    // Simulate Enter key press
    const event = new KeyboardEvent("keydown", { key: "Enter" });

    // Should not throw error even without onSubmit
    expect(() => {
      act(() => {
        result.current.inputProps.onKeyDown?.(event as any);
      });
    }).not.toThrow();
  });
});

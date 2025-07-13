import { renderHook, act } from "@testing-library/react";
import { BaseDatePicker } from "../BaseDatePicker";

describe("BaseDatePicker with behavior flag", () => {
  const testDate = new Date("2024-01-15");

  it("should NOT auto-submit when autoSubmitOnChange is false", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseDatePicker({
        value: null,
        onChange,
        onSubmit,
        autoSubmitOnChange: false, // New prop
      }),
    );

    act(() => {
      // Directly call the internal selectDate method
      result.current.selectDate(testDate);
    });

    expect(onChange).toHaveBeenCalledWith(testDate);
    expect(onSubmit).not.toHaveBeenCalled(); // Key assertion
  });

  it("should auto-submit when autoSubmitOnChange is true (default)", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseDatePicker({
        value: null,
        onChange,
        onSubmit,
        // autoSubmitOnChange defaults to true
      }),
    );

    act(() => {
      result.current.selectDate(testDate);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should maintain backward compatibility when prop is not specified", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseDatePicker({
        value: null,
        onChange,
        onSubmit,
        // autoSubmitOnChange not specified - should default to true
      }),
    );

    act(() => {
      result.current.selectDate(testDate);
    });

    expect(onChange).toHaveBeenCalledWith(testDate);
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should still auto-submit by default
  });
});

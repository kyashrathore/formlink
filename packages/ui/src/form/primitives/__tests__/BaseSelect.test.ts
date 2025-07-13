import { renderHook, act } from "@testing-library/react";
import { BaseSelect } from "../BaseSelect";

describe("BaseSelect with behavior flag", () => {
  const mockOptions = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "orange", label: "Orange" },
  ];

  it("should NOT auto-submit when autoSubmitOnChange is false", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        autoSubmitOnChange: false, // New prop
      }),
    );

    act(() => result.current.selectOption("apple"));

    expect(onChange).toHaveBeenCalledWith("apple");
    expect(onSubmit).not.toHaveBeenCalled(); // Key assertion
  });

  it("should auto-submit when autoSubmitOnChange is true (default)", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        // autoSubmitOnChange defaults to true
      }),
    );

    act(() => result.current.selectOption("banana"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("should maintain backward compatibility when prop is not specified", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        // autoSubmitOnChange not specified - should default to true
      }),
    );

    act(() => result.current.selectOption("orange"));

    expect(onChange).toHaveBeenCalledWith("orange");
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should still auto-submit by default
  });

  it("should NOT auto-submit on selection by index when autoSubmitOnChange is false", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        autoSubmitOnChange: false,
      }),
    );

    act(() => result.current.selectByIndex(1));

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(onSubmit).not.toHaveBeenCalled(); // Should not submit when flag is false
  });

  it("should NOT auto-submit on keyboard selection when autoSubmitOnChange is false", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        autoSubmitOnChange: false,
        enableShortcuts: true,
      }),
    );

    // Simulate keyboard shortcut '1' to select first option
    const event = new KeyboardEvent("keydown", { key: "1" });
    act(() => {
      result.current.containerProps.onKeyDown?.(event as any);
    });

    expect(onChange).toHaveBeenCalledWith("apple");
    expect(onSubmit).not.toHaveBeenCalled(); // Should not submit when flag is false
  });

  it("should auto-submit on keyboard selection when autoSubmitOnChange is true", () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseSelect({
        value: null,
        onChange,
        onSubmit,
        options: mockOptions,
        autoSubmitOnChange: true,
        enableShortcuts: true,
      }),
    );

    // Simulate keyboard shortcut '2' to select second option
    const event = new KeyboardEvent("keydown", { key: "2" });
    act(() => {
      result.current.containerProps.onKeyDown?.(event as any);
    });

    expect(onChange).toHaveBeenCalledWith("banana");
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should submit when flag is true
  });
});

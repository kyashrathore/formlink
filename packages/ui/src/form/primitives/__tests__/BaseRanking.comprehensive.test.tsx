import React from "react";
import { renderHook, act } from "@testing-library/react";
import { BaseRanking, BaseRankingProps } from "../BaseRanking";
import { Option } from "../types";

describe("BaseRanking Comprehensive Tests", () => {
  const mockOptions: Option[] = [
    { value: "1", label: "First Item" },
    { value: "2", label: "Second Item" },
    { value: "3", label: "Third Item" },
    { value: "4", label: "Fourth Item" },
  ];

  const defaultProps: BaseRankingProps = {
    value: [],
    onChange: jest.fn(),
    options: mockOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Drag and Drop functionality", () => {
    it("should provide drag handlers in item props", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
        }),
      );

      const itemProps = result.current.getItemProps(0);

      expect(itemProps).toHaveProperty("draggable", true);
      expect(itemProps).toHaveProperty("onDragStart");
      expect(itemProps).toHaveProperty("onDragEnd");
      expect(itemProps).toHaveProperty("onDragOver");
      expect(itemProps).toHaveProperty("onDrop");
    });

    it("should handle drag start", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
        }),
      );

      act(() => {
        result.current.setDraggedItem("2");
      });

      expect(result.current.draggedItem).toBe("2");
    });

    it("should mark dragged item in items array", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
        }),
      );

      act(() => {
        result.current.setDraggedItem("2");
      });

      const draggedItem = result.current.items.find(
        (item) => item.value === "2",
      );
      expect(draggedItem?.isDragging).toBe(true);
    });
  });

  describe("Keyboard navigation", () => {
    it("should provide keyboard handler in container props", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          enableKeyboard: true,
        }),
      );

      expect(result.current.containerProps.onKeyDown).toBeDefined();
    });

    it("should not provide keyboard handler when disabled", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          enableKeyboard: false,
        }),
      );

      expect(result.current.containerProps.onKeyDown).toBeUndefined();
    });
  });

  describe("Touch support", () => {
    it("should provide touch handlers when enabled", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          enableTouch: true,
        }),
      );

      const itemProps = result.current.getItemProps(0);

      expect(itemProps).toHaveProperty("onTouchStart");
      expect(itemProps).toHaveProperty("onTouchMove");
      expect(itemProps).toHaveProperty("onTouchEnd");
    });

    it("should not provide touch handlers when disabled", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          enableTouch: false,
        }),
      );

      const itemProps = result.current.getItemProps(0);

      expect(itemProps.onTouchStart).toBeUndefined();
      expect(itemProps.onTouchMove).toBeUndefined();
      expect(itemProps.onTouchEnd).toBeUndefined();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          ariaLabel: "Rank items",
          ariaDescribedBy: "help-text",
          required: true,
        }),
      );

      const containerProps = result.current.containerProps;

      expect(containerProps["aria-label"]).toBe("Rank items");
      expect(containerProps["aria-describedby"]).toBe("help-text");
      expect(containerProps["aria-required"]).toBe(true);
      expect(containerProps["aria-disabled"]).toBe(false);
      expect(containerProps.role).toBe("list");
    });

    it("should set aria-invalid when there are errors", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: [],
          required: true,
        }),
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.containerProps["aria-invalid"]).toBe(true);
    });

    it("should provide announcement mechanism", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange: jest.fn(),
        }),
      );

      expect(result.current.announcement).toBe("");

      act(() => {
        result.current.setAnnouncement("Item moved");
      });

      expect(result.current.announcement).toBe("Item moved");
    });
  });

  describe("SetRank functionality", () => {
    it("should set rank for an item", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange,
        }),
      );

      act(() => {
        result.current.setRank("3", 1); // Move item 3 to position 1
      });

      expect(onChange).toHaveBeenCalledWith(["3", "1", "2", "4"]);
    });

    it("should remove item when rank is 0", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange,
        }),
      );

      act(() => {
        result.current.setRank("2", 0); // Unrank item 2
      });

      expect(onChange).toHaveBeenCalledWith(["1", "3", "4"]);
    });
  });

  describe("Clear and Reset", () => {
    it("should clear all rankings", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange,
        }),
      );

      act(() => {
        result.current.setDraggedItem("2");
        result.current.setTouched(true);
        result.current.clear();
      });

      expect(onChange).toHaveBeenCalledWith([]);
      expect(result.current.isTouched).toBe(false);
      expect(result.current.draggedItem).toBe(null);
      expect(result.current.errors).toEqual([]);
    });

    it("should reset to initial state", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange,
        }),
      );

      act(() => {
        result.current.setDraggedItem("2");
        result.current.setTouched(true);
        result.current.setAnnouncement("Test announcement");
        result.current.reset();
      });

      expect(onChange).toHaveBeenCalledWith([]);
      expect(result.current.isTouched).toBe(false);
      expect(result.current.draggedItem).toBe(null);
      expect(result.current.announcement).toBe("");
    });
  });

  describe("Item generation", () => {
    it("should generate items with correct structure", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["2", "1", "3", "4"],
        }),
      );

      expect(result.current.items).toHaveLength(4);

      const firstItem = result.current.items[0];
      expect(firstItem.value).toBe("2");
      expect(firstItem.label).toBe("Second Item");
      expect(firstItem.index).toBe(0);
      expect(firstItem.props).toBeDefined();
      expect(firstItem.isDragging).toBe(false);
      expect(firstItem.isDropTarget).toBe(false);
    });

    it("should use option order when value is empty", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: [],
        }),
      );

      expect(result.current.items).toHaveLength(4);
      expect(result.current.items[0].value).toBe("1");
      expect(result.current.items[1].value).toBe("2");
      expect(result.current.items[2].value).toBe("3");
      expect(result.current.items[3].value).toBe("4");
    });
  });

  describe("Disabled state", () => {
    it("should not allow reordering when disabled", () => {
      const onChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          onChange,
          disabled: true,
        }),
      );

      act(() => {
        result.current.reorder(0, 1);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should not allow drag when disabled", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          disabled: true,
        }),
      );

      const itemProps = result.current.getItemProps(0);
      expect(itemProps.draggable).toBe(false);
    });

    it("should set aria-disabled when disabled", () => {
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2", "3", "4"],
          disabled: true,
        }),
      );

      expect(result.current.containerProps["aria-disabled"]).toBe(true);
    });
  });

  describe("Custom validation", () => {
    it("should call custom validation function", () => {
      const customValidation = jest
        .fn()
        .mockReturnValue([{ type: "custom", message: "Custom error" }]);

      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: ["1", "2"],
          onValidate: customValidation,
        }),
      );

      act(() => {
        const errors = result.current.validate();
        expect(customValidation).toHaveBeenCalledWith(["1", "2"]);
        expect(errors).toHaveLength(1);
        expect(errors[0].type).toBe("custom");
      });
    });

    it("should call onValidationChange when errors change", () => {
      const onValidationChange = jest.fn();
      const { result } = renderHook(() =>
        BaseRanking({
          ...defaultProps,
          value: [],
          required: true,
          onValidationChange,
        }),
      );

      act(() => {
        result.current.validate();
      });

      expect(onValidationChange).toHaveBeenCalledWith([
        { type: "required", message: "Please rank at least one item" },
      ]);
    });
  });
});

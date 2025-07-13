import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { BaseRanking, BaseRankingProps } from '../BaseRanking';
import { Option } from '../types';

describe('BaseRanking Simple Tests', () => {
  const mockOptions: Option[] = [
    { value: '1', label: 'First Item' },
    { value: '2', label: 'Second Item' },
    { value: '3', label: 'Third Item' },
    { value: '4', label: 'Fourth Item' },
  ];

  const defaultProps: BaseRankingProps = {
    value: [],
    onChange: jest.fn(),
    options: mockOptions,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    const { result } = renderHook(() =>
      BaseRanking({
        ...defaultProps,
        value: ['1', '2', '3', '4'],
      })
    );

    expect(result.current.value).toEqual(['1', '2', '3', '4']);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isTouched).toBe(false);
  });

  it('should reorder items', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      BaseRanking({
        ...defaultProps,
        value: ['1', '2', '3', '4'],
        onChange,
      })
    );

    act(() => {
      result.current.reorder(0, 2);
    });

    expect(onChange).toHaveBeenCalledWith(['2', '3', '1', '4']);
  });

  it('should validate required field', () => {
    const { result } = renderHook(() =>
      BaseRanking({
        ...defaultProps,
        value: [],
        required: true,
      })
    );

    act(() => {
      const errors = result.current.validate();
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('required');
    });
  });

  it('should handle autoSubmitOnChange flag', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    
    // Test with autoSubmitOnChange = false
    const { result: result1 } = renderHook(() =>
      BaseRanking({
        ...defaultProps,
        value: ['1', '2', '3', '4'],
        onChange,
        onSubmit,
        autoSubmitOnChange: false,
      })
    );

    act(() => {
      result1.current.reorder(0, 1);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();

    // Reset mocks
    onChange.mockClear();
    onSubmit.mockClear();

    // Test with autoSubmitOnChange = true
    const { result: result2 } = renderHook(() =>
      BaseRanking({
        ...defaultProps,
        value: ['1', '2', '3', '4'],
        onChange,
        onSubmit,
        autoSubmitOnChange: true,
      })
    );

    act(() => {
      result2.current.reorder(0, 1);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
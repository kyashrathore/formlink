import { renderHook, act } from '@testing-library/react';
import { BaseLinearScale } from '../BaseLinearScale';

describe('BaseLinearScale with behavior flag', () => {
  it('should NOT auto-submit when autoSubmitOnChange is false', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseLinearScale({
        value: null,
        onChange,
        onSubmit,
        config: { start: 1, end: 5, step: 1 },
        autoSubmitOnChange: false // New prop
      })
    );
    
    // Get props for value 3 and simulate click
    const optionProps = result.current.getOptionProps(3);
    act(() => {
      optionProps.onClick?.({} as any);
    });
    
    expect(onChange).toHaveBeenCalledWith(3);
    expect(onSubmit).not.toHaveBeenCalled(); // Key assertion
  });
  
  it('should auto-submit when autoSubmitOnChange is true (default)', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseLinearScale({
        value: null,
        onChange,
        onSubmit,
        config: { start: 1, end: 5, step: 1 }
        // autoSubmitOnChange defaults to true
      })
    );
    
    // Get props for value 3 and simulate click
    const optionProps = result.current.getOptionProps(3);
    act(() => {
      optionProps.onClick?.({} as any);
    });
    
    expect(onChange).toHaveBeenCalledWith(3);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  
  it('should maintain backward compatibility when prop is not specified', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseLinearScale({
        value: null,
        onChange,
        onSubmit,
        config: { start: 1, end: 5, step: 1 }
        // autoSubmitOnChange not specified - should default to true
      })
    );
    
    // Get props for value 5 and simulate click
    const optionProps = result.current.getOptionProps(5);
    act(() => {
      optionProps.onClick?.({} as any);
    });
    
    expect(onChange).toHaveBeenCalledWith(5);
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should still auto-submit by default
  });
  
  it('should not throw error when onSubmit is not provided', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseLinearScale({
        value: null,
        onChange,
        // No onSubmit provided
        config: { start: 1, end: 5, step: 1 },
        autoSubmitOnChange: true
      })
    );
    
    // Should not throw error even without onSubmit
    expect(() => {
      // Get props for value 2 and simulate click
      const optionProps = result.current.getOptionProps(2);
      act(() => {
        optionProps.onClick?.({} as any);
      });
    }).not.toThrow();
    
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
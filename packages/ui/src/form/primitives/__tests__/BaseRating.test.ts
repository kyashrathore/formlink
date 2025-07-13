import { renderHook, act } from '@testing-library/react';
import { BaseRating } from '../BaseRating';

describe('BaseRating with behavior flag', () => {
  it('should NOT auto-submit when autoSubmitOnChange is false', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseRating({
        value: 0,
        onChange,
        onSubmit,
        autoSubmitOnChange: false // New prop
      })
    );
    
    act(() => result.current.setRating(3));
    
    expect(onChange).toHaveBeenCalledWith(3);
    expect(onSubmit).not.toHaveBeenCalled(); // Key assertion
  });
  
  it('should auto-submit when autoSubmitOnChange is true (default)', () => {
    const onSubmit = jest.fn();
    const { result } = renderHook(() => 
      BaseRating({
        value: 0,
        onChange: jest.fn(),
        onSubmit
        // autoSubmitOnChange defaults to true
      })
    );
    
    act(() => result.current.setRating(3));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
  
  it('should maintain backward compatibility when prop is not specified', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseRating({
        value: 0,
        onChange,
        onSubmit
        // autoSubmitOnChange not specified - should default to true
      })
    );
    
    act(() => result.current.setRating(5));
    
    expect(onChange).toHaveBeenCalledWith(5);
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should still auto-submit by default
  });
  
  it('should NOT auto-submit on Enter key when autoSubmitOnChange is false', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseRating({
        value: 3,
        onChange,
        onSubmit,
        autoSubmitOnChange: false,
        enableKeyboard: true
      })
    );
    
    // Simulate Enter key press
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    act(() => {
      result.current.containerProps.onKeyDown?.(event as any);
    });
    
    expect(onSubmit).not.toHaveBeenCalled(); // Should not submit when flag is false
  });
  
  it('should auto-submit on Enter key when autoSubmitOnChange is true', () => {
    const onSubmit = jest.fn();
    const onChange = jest.fn();
    const { result } = renderHook(() => 
      BaseRating({
        value: 3,
        onChange,
        onSubmit,
        autoSubmitOnChange: true,
        enableKeyboard: true
      })
    );
    
    // Simulate Enter key press
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    act(() => {
      result.current.containerProps.onKeyDown?.(event as any);
    });
    
    expect(onSubmit).toHaveBeenCalledTimes(1); // Should submit when flag is true
  });
});
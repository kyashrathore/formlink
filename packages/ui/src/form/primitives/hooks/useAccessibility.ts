export interface UseAccessibilityProps {
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  role?: string;
}

export interface UseAccessibilityReturn {
  ariaProps: {
    id?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    'aria-labelledby'?: string;
    'aria-required'?: boolean;
    'aria-disabled'?: boolean;
    'aria-invalid'?: boolean;
    role?: string;
  };
  announceChange: (message: string) => void;
}

/**
 * Hook for managing accessibility attributes and screen reader announcements
 */
export function useAccessibility(props: UseAccessibilityProps): UseAccessibilityReturn {
  const {
    id,
    ariaLabel,
    ariaDescribedBy,
    ariaLabelledBy,
    required,
    disabled,
    invalid,
    role,
  } = props;

  const announceChange = (message: string) => {
    // Create a live region announcement
    if (typeof window !== 'undefined') {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      
      announcement.textContent = message;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  };

  return {
    ariaProps: {
      id,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'aria-labelledby': ariaLabelledBy,
      'aria-required': required,
      'aria-disabled': disabled,
      'aria-invalid': invalid,
      role,
    },
    announceChange,
  };
}
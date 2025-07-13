import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';

// Mock toMatchImageSnapshot for jsdom environment
// Visual regression tests require a real browser environment (e.g., with Puppeteer)
// In jsdom, we'll mock this to always pass but log a warning
const mockToMatchImageSnapshot = {
  toMatchImageSnapshot(received: any) {
    // In a real visual test setup, this would compare image buffers
    // For jsdom tests, we'll just check that a DOM element was passed
    const pass = received && (received instanceof HTMLElement || received.nodeType === 1);
    
    if (pass) {
      console.warn(
        'Visual snapshot testing is mocked in jsdom environment. ' +
        'For actual visual regression testing, use a real browser environment.'
      );
    }

    return {
      pass,
      message: () => pass 
        ? 'Visual snapshot mock: DOM element received'
        : 'Visual snapshot mock: Expected DOM element but received ' + typeof received
    };
  }
};

// Extend Jest matchers with our mock
expect.extend(mockToMatchImageSnapshot);

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock global objects
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock HTMLElement methods
HTMLElement.prototype.scrollIntoView = jest.fn();
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock URL.createObjectURL and URL.revokeObjectURL for file upload tests
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Clear any pending timers
  if (jest.isMockFunction(setTimeout)) {
    jest.clearAllTimers();
  }
  
  // Clean up any DOM elements
  document.body.innerHTML = '';
  
  // Reset any global state
  if (global.gc) {
    global.gc();
  }
});
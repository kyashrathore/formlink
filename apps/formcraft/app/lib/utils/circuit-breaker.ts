interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
}

const circuitStates = new Map<string, CircuitBreakerState>();

export class CircuitBreaker {
  constructor(
    private key: string,
    private options: {
      failureThreshold: number;
      recoveryTimeout: number;
      monitor?: boolean;
    },
  ) {}

  canExecute(): boolean {
    const state = this.getState();

    if (state.state === "closed") return true;
    if (state.state === "open") {
      // Check if recovery timeout has passed
      if (Date.now() - state.lastFailureTime > this.options.recoveryTimeout) {
        this.setState({ ...state, state: "half-open" });
        return true;
      }
      return false;
    }
    if (state.state === "half-open") return true;

    return false;
  }

  recordSuccess(): void {
    const state = this.getState();
    this.setState({
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
    });

    if (this.options.monitor) {
      console.log(`Circuit breaker ${this.key}: Success recorded, state reset to closed`);
    }
  }

  recordFailure(): void {
    const state = this.getState();
    const newFailures = state.failures + 1;

    this.setState({
      failures: newFailures,
      lastFailureTime: Date.now(),
      state: newFailures >= this.options.failureThreshold ? "open" : "closed",
    });

    if (this.options.monitor) {
      console.log(`Circuit breaker ${this.key}: Failure recorded (${newFailures}/${this.options.failureThreshold}), state: ${this.getState().state}`);
    }
  }

  getState(): CircuitBreakerState {
    return (
      circuitStates.get(this.key) || {
        failures: 0,
        lastFailureTime: 0,
        state: "closed",
      }
    );
  }

  private setState(state: CircuitBreakerState): void {
    circuitStates.set(this.key, state);
  }

  // Get circuit breaker metrics
  getMetrics(): {
    key: string;
    state: string;
    failures: number;
    lastFailureTime: number;
    canExecute: boolean;
  } {
    const state = this.getState();
    return {
      key: this.key,
      state: state.state,
      failures: state.failures,
      lastFailureTime: state.lastFailureTime,
      canExecute: this.canExecute(),
    };
  }

  // Reset circuit breaker to closed state
  reset(): void {
    this.setState({
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
    });

    if (this.options.monitor) {
      console.log(`Circuit breaker ${this.key}: Manually reset to closed`);
    }
  }
}

// Utility functions for managing circuit breakers
export function getAllCircuitBreakerStates(): Record<string, CircuitBreakerState> {
  const states: Record<string, CircuitBreakerState> = {};
  for (const [key, value] of circuitStates.entries()) {
    states[key] = value;
  }
  return states;
}

export function resetAllCircuitBreakers(): void {
  circuitStates.clear();
  console.log("All circuit breakers have been reset");
}

export function getCircuitBreakerMetrics(): Array<{
  key: string;
  state: string;
  failures: number;
  lastFailureTime: number;
}> {
  return Array.from(circuitStates.entries()).map(([key, state]) => ({
    key,
    state: state.state,
    failures: state.failures,
    lastFailureTime: state.lastFailureTime,
  }));
}
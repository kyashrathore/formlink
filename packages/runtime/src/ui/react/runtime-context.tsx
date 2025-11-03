"use client";
import * as React from "react";
import { Devtools } from "../../devtools/Devtools";
import type { FormlinkFlow } from "../../core/formlinkFlow";
import type { RuntimeApi } from "../../types";

const RuntimeReactContext = React.createContext<RuntimeApi | null>(null);

export function RuntimeProvider({
  runtime,
  children,
  showDevtools,
  flowEngine,
}: {
  runtime: RuntimeApi;
  children: React.ReactNode;
  showDevtools: boolean;
  flowEngine?: FormlinkFlow;
}) {
  return (
    <RuntimeReactContext.Provider value={runtime}>
      <div className="flex w-full">
        {showDevtools && (
          <div
            className="max-h-screen overflow-y-auto"
            style={{ maxHeight: "100vh" }}
          >
            <Devtools
              runtime={runtime}
              flowEngine={flowEngine}
              label="Show devtools"
            />
          </div>
        )}
        <div className="w-full">{children}</div>
      </div>
    </RuntimeReactContext.Provider>
  );
}

export function useRuntime(): RuntimeApi | null {
  return React.useContext(RuntimeReactContext);
}

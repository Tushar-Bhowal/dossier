"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { ActiveRunsProvider } from "@/hooks/use-active-runs";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ActiveRunsProvider>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </ActiveRunsProvider>
    </QueryClientProvider>
  );
}


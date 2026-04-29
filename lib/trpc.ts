import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 *
 * The `url` is provided as a function so it is evaluated fresh on every
 * request at runtime — not once at build/module-load time. This prevents
 * a stale dev-server origin (baked in at compile time) from being used
 * when the app is deployed on Railway, where `window.location.origin`
 * correctly reflects the live domain.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        // Returning a function here makes tRPC call it per-request, so
        // `getApiBaseUrl()` (and therefore `window.location.origin`) is
        // read at request time rather than at client-creation time.
        url: () => `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}

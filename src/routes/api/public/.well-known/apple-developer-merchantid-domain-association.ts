import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Serves the Apple Pay domain association file required by Apple/Paddle
 * to verify ownership of ritajet.com for native Apple Pay checkout.
 * Place file at: public/.well-known/apple-developer-merchantid-domain-association
 */
export const Route = createFileRoute(
  "/api/public/.well-known/apple-developer-merchantid-domain-association",
)({
  server: {
    handlers: {
      GET: async () => {
        try {
          const filePath = resolve(
            process.cwd(),
            "public/.well-known/apple-developer-merchantid-domain-association",
          );
          const content = readFileSync(filePath, "utf-8");
          return new Response(content, {
            headers: {
              "content-type": "text/plain",
              "cache-control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
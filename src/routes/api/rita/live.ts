import { createFileRoute } from "@tanstack/react-router";

function retired() {
  return Response.json(
    {
      error:
        "This legacy realtime route is retired. Rita now uses the cost-controlled voice pipeline.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/rita/live")({
  server: {
    handlers: {
      GET: retired,
      POST: retired,
    },
  },
});

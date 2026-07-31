/**
 * Next.js Instrumentation
 *
 * Starts the cron scheduler on server startup.
 * Wrapped in try/catch so the app still works even if
 * node-cron has loading issues in the dev bundler.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { ensureSchedulerStarted } = await import("@/lib/scheduler");
    ensureSchedulerStarted();
  } catch (error) {
    console.warn(
      "[instrumentation] Could not start scheduler:",
      (error as Error).message
    );
    console.warn(
      "[instrumentation] Auto-sync disabled. You can still sync manually."
    );
  }
}

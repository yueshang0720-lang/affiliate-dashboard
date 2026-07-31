/**
 * Scheduler
 *
 * Uses setInterval to run automatic data sync on a schedule.
 * The interval is configured via SYNC_INTERVAL_MINUTES env var (default: 1440 = 24h).
 *
 * Set to 0 to disable auto-sync.
 */

import { runSync } from "./sync-service";

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (intervalId) {
    console.log("[scheduler] Already running");
    return;
  }

  const intervalMinutes = parseInt(
    process.env.SYNC_INTERVAL_MINUTES || "1440",
    10
  );

  if (intervalMinutes <= 0) {
    console.log("[scheduler] Auto-sync disabled (SYNC_INTERVAL_MINUTES=0)");
    return;
  }

  const ms = intervalMinutes * 60 * 1000;
  console.log(
    `[scheduler] Auto-sync every ${intervalMinutes} minutes (${(intervalMinutes / 60).toFixed(1)} hours)`
  );

  intervalId = setInterval(async () => {
    console.log(
      `[scheduler] Running scheduled sync at ${new Date().toISOString()}`
    );
    try {
      const result = await runSync();
      console.log(`[scheduler] Sync completed: ${result.message}`);
    } catch (error) {
      console.error("[scheduler] Sync failed:", error);
    }
  }, ms);

  // Also run once on startup
  console.log("[scheduler] Running initial sync on startup...");
  runSync()
    .then((result) =>
      console.log(`[scheduler] Initial sync done: ${result.message}`)
    )
    .catch((error) =>
      console.error("[scheduler] Initial sync failed:", error)
    );
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[scheduler] Stopped");
  }
}

export function getSchedulerStatus(): {
  running: boolean;
  intervalMinutes: number;
} {
  return {
    running: intervalId !== null,
    intervalMinutes: parseInt(
      process.env.SYNC_INTERVAL_MINUTES || "1440",
      10
    ),
  };
}

let started = false;

export function ensureSchedulerStarted(): void {
  if (started) return;
  started = true;
  startScheduler();
  console.log("[scheduler] Initialized");
}

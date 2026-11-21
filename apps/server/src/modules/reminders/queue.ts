import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../../config/env';

/**
 * Reminders run on BullMQ: each pending reminder is one delayed job keyed by its next run time.
 * Editing a reminder doesn't hunt down the old job; the worker drops jobs whose time no longer
 * matches the reminder (see fireReminder).
 */

export interface ReminderJob {
  id: string;
  /** nextRunAt in ms when the job was queued. */
  at: number;
}

const NAME = 'reminders';
let queue: Queue<ReminderJob> | null = null;
let worker: Worker<ReminderJob> | null = null;

export async function scheduleReminder(id: string, nextRunAt: Date | null): Promise<void> {
  if (!queue || !nextRunAt) return;
  const at = nextRunAt.getTime();
  await queue.add(
    'fire',
    { id, at },
    {
      jobId: `${id}-${at}`, // the same run is never queued twice
      delay: Math.max(0, at - Date.now()),
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 500,
    },
  );
}

/** Starts the queue and a worker in this process. Several API instances share the work. */
export function startReminderQueue(fire: (job: ReminderJob) => Promise<void>): void {
  // BullMQ blocks on its connections, so it gets its own (with no per-request retry limit).
  const connection = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  queue = new Queue<ReminderJob>(NAME, { connection: connection() });
  worker = new Worker<ReminderJob>(NAME, (job) => fire(job.data), {
    connection: connection(),
    concurrency: 5,
  });
  worker.on('failed', (job, err) => console.error(`Reminder job ${job?.id} failed:`, err));
}

export async function stopReminderQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  queue = worker = null;
}

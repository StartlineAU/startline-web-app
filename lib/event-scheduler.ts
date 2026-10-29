import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  ResourceNotFoundException,
  SchedulerClient,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import type { EventStatus } from "@prisma/client";

/**
 * Background lifecycle triggers.
 *
 * The scheduled Lambda only wakes the app's internal lifecycle route. It never
 * writes to the database directly, so all transitions share the same logic as
 * an edit-time refresh and can be retried safely.
 *
 * Local development and unit tests have no scheduler configuration and this
 * module becomes a no-op. The periodic reconciliation route still advances due
 * events in every environment.
 */

export interface SchedulableEvent {
  id: string;
  status: EventStatus | string;
  startsAtUtc: Date | null;
  endsAtUtc: Date | null;
}

interface SchedulerConfig {
  groupName: string;
  roleArn: string;
  lambdaArn: string;
}

let client: SchedulerClient | null = null;

/** EventBridge Scheduler needs a future invocation; sub-minute edges fall back
 * to the one-minute reconciliation rather than failing the write. */
const MIN_SCHEDULE_LEAD_MS = 60_000;

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ResourceNotFoundException ||
    (typeof err === "object" && err !== null && (err as { name?: string }).name === "ResourceNotFoundException")
  );
}

function config(): SchedulerConfig | null {
  const groupName = process.env.EVENT_SCHEDULE_GROUP;
  const roleArn = process.env.EVENT_SCHEDULER_ROLE_ARN;
  const lambdaArn = process.env.EVENT_LIFECYCLE_LAMBDA_ARN;
  if (!groupName || !roleArn || !lambdaArn) return null;
  return { groupName, roleArn, lambdaArn };
}

function scheduler(): SchedulerClient {
  if (!client) {
    client = new SchedulerClient({
      region: process.env.AWS_REGION ?? process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-southeast-2",
    });
  }
  return client;
}

export type LifecycleTransition = "start" | "end";

export function eventScheduleName(eventId: string, transition: LifecycleTransition): string {
  return `event-${eventId}-${transition}`;
}

function atExpression(date: Date): string {
  return `at(${date.toISOString().slice(0, 19)})`;
}

function target(config: SchedulerConfig, eventId: string, transition: LifecycleTransition) {
  return {
    Arn: config.lambdaArn,
    RoleArn: config.roleArn,
    Input: JSON.stringify({ eventId, transition }),
  };
}

async function upsertSchedule(
  config: SchedulerConfig,
  event: SchedulableEvent,
  transition: LifecycleTransition,
  when: Date,
) {
  const Name = eventScheduleName(event.id, transition);
  const command = {
    Name,
    GroupName: config.groupName,
    ScheduleExpression: atExpression(when),
    FlexibleTimeWindow: { Mode: "OFF" as const },
    Target: target(config, event.id, transition),
    ActionAfterCompletion: "DELETE" as const,
    State: "ENABLED" as const,
  };

  try {
    await scheduler().send(new UpdateScheduleCommand(command));
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await scheduler().send(new CreateScheduleCommand(command));
  }
}

async function removeSchedule(config: SchedulerConfig, eventId: string, transition: LifecycleTransition) {
  try {
    await scheduler().send(
      new DeleteScheduleCommand({
        Name: eventScheduleName(eventId, transition),
        GroupName: config.groupName,
      }),
    );
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

/**
 * Make the two one-time triggers agree with the event's current times and
 * status. Errors are logged by the caller; the minute reconciliation retries.
 */
export async function syncEventSchedules(
  event: SchedulableEvent,
  now: Date = new Date(),
): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const start = event.startsAtUtc ? new Date(event.startsAtUtc) : null;
  const end = event.endsAtUtc ? new Date(event.endsAtUtc) : null;
  const live = event.status === "APPROVED" || event.status === "IN_PROGRESS";

  if (!live) {
    await Promise.all([
      removeSchedule(cfg, event.id, "start"),
      removeSchedule(cfg, event.id, "end"),
    ]);
    return;
  }

  if (
    event.status === "APPROVED" &&
    start &&
    start.getTime() > now.getTime() + MIN_SCHEDULE_LEAD_MS
  ) {
    await upsertSchedule(cfg, event, "start", start);
  } else {
    await removeSchedule(cfg, event.id, "start");
  }

  if (end && end.getTime() > now.getTime() + MIN_SCHEDULE_LEAD_MS) {
    await upsertSchedule(cfg, event, "end", end);
  } else {
    await removeSchedule(cfg, event.id, "end");
  }
}

/** Best-effort schedule cleanup used after deleting an event. */
export async function cancelEventSchedules(eventId: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  await Promise.all([
    removeSchedule(cfg, eventId, "start"),
    removeSchedule(cfg, eventId, "end"),
  ]);
}

export function eventSchedulerConfigured(): boolean {
  return config() !== null;
}

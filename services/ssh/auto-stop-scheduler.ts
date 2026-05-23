import { randomUUID } from "crypto";

import { prisma } from "../../packages/db/src";
import {
  stopActiveSSHRemotes,
  stopSSHRemoteById,
} from "./stop-remote";

export type AutoStopTargetType = "SSH_REMOTE" | "ALL_ACTIVE";
export type AutoStopStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED";

export type AutoStopRow = {
  id: string;
  sshRemoteId: string | null;
  sshRemoteName: string | null;
  targetType: AutoStopTargetType;
  scheduledAt: Date;
  status: AutoStopStatus;
  executedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const MAX_TIMER_DELAY_MS = 2_147_483_647;

const globalForAutoStop = globalThis as typeof globalThis & {
  __aisshAutoStopTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __aisshAutoStopHydrated?: boolean;
  __aisshAutoStopSchemaPromise?: Promise<void>;
};

function getTimers() {
  if (!globalForAutoStop.__aisshAutoStopTimers) {
    globalForAutoStop.__aisshAutoStopTimers = new Map();
  }

  return globalForAutoStop.__aisshAutoStopTimers;
}

function serializeAutoStop(row: AutoStopRow) {
  return {
    ...row,
    scheduledAt: row.scheduledAt.toISOString(),
    executedAt: row.executedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function createAutoStopSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "AutoStopTargetType" AS ENUM ('SSH_REMOTE', 'ALL_ACTIVE');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      CREATE TYPE "AutoStopStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELED', 'FAILED');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AutoStop" (
      "id" TEXT NOT NULL,
      "sshRemoteId" TEXT,
      "targetType" "AutoStopTargetType" NOT NULL DEFAULT 'SSH_REMOTE',
      "scheduledAt" TIMESTAMP(3) NOT NULL,
      "status" "AutoStopStatus" NOT NULL DEFAULT 'PENDING',
      "executedAt" TIMESTAMP(3),
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "AutoStop_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AutoStop_status_scheduledAt_idx"
    ON "AutoStop"("status", "scheduledAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AutoStop_sshRemoteId_status_idx"
    ON "AutoStop"("sshRemoteId", "status");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'AutoStop_sshRemoteId_fkey'
      ) THEN
        ALTER TABLE "AutoStop"
        ADD CONSTRAINT "AutoStop_sshRemoteId_fkey"
        FOREIGN KEY ("sshRemoteId") REFERENCES "SSHRemote"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

async function ensureAutoStopSchema() {
  if (!globalForAutoStop.__aisshAutoStopSchemaPromise) {
    globalForAutoStop.__aisshAutoStopSchemaPromise = createAutoStopSchema();
  }

  return globalForAutoStop.__aisshAutoStopSchemaPromise;
}

async function getPendingAutoStops() {
  await ensureAutoStopSchema();

  return prisma.$queryRawUnsafe<AutoStopRow[]>(
    `SELECT
      a."id",
      a."sshRemoteId",
      s."name" AS "sshRemoteName",
      a."targetType"::text AS "targetType",
      a."scheduledAt",
      a."status"::text AS "status",
      a."executedAt",
      a."error",
      a."createdAt",
      a."updatedAt"
    FROM "AutoStop"
    a
    LEFT JOIN "SSHRemote" s ON s."id" = a."sshRemoteId"
    WHERE a."status" = 'PENDING'::"AutoStopStatus"
    ORDER BY a."scheduledAt" ASC`,
  );
}

async function updateAutoStopStatus(
  id: string,
  status: AutoStopStatus,
  data: {
    executedAt?: Date | null;
    error?: string | null;
  } = {},
) {
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `UPDATE "AutoStop"
     SET
      "status" = $2::"AutoStopStatus",
      "executedAt" = COALESCE($3, "executedAt"),
      "error" = $4,
      "updatedAt" = $5
     WHERE "id" = $1`,
    id,
    status,
    data.executedAt ?? null,
    data.error ?? null,
    now,
  );
}

function scheduleAutoStopTimer(row: Pick<AutoStopRow, "id" | "scheduledAt">) {
  const timers = getTimers();
  const existing = timers.get(row.id);

  if (existing) {
    clearTimeout(existing);
  }

  const delay = Math.max(0, row.scheduledAt.getTime() - Date.now());
  const timer = setTimeout(() => {
    timers.delete(row.id);

    if (delay > MAX_TIMER_DELAY_MS) {
      scheduleAutoStopTimer(row);
      return;
    }

    void runDueAutoStops();
  }, Math.min(delay, MAX_TIMER_DELAY_MS));

  timers.set(row.id, timer);
}

export async function hydrateAutoStopTimers() {
  if (globalForAutoStop.__aisshAutoStopHydrated) {
    return;
  }

  globalForAutoStop.__aisshAutoStopHydrated = true;

  const rows = await getPendingAutoStops();

  for (const row of rows) {
    scheduleAutoStopTimer(row);
  }
}

async function executeAutoStop(row: AutoStopRow) {
  await updateAutoStopStatus(row.id, "RUNNING");

  try {
    if (row.targetType === "ALL_ACTIVE") {
      const { results, errors } = await stopActiveSSHRemotes();
      await updateAutoStopStatus(row.id, "COMPLETED", {
        executedAt: new Date(),
        error:
          errors.length > 0
            ? JSON.stringify({
                stopped: results.length,
                errors,
              })
            : null,
      });
      return;
    }

    if (!row.sshRemoteId) {
      throw new Error("Auto stop target is missing an SSH id");
    }

    const result = await stopSSHRemoteById(row.sshRemoteId);

    await updateAutoStopStatus(row.id, "COMPLETED", {
      executedAt: new Date(),
      error: result.providerError,
    });
  } catch (error) {
    await updateAutoStopStatus(row.id, "FAILED", {
      executedAt: new Date(),
      error: serializeError(error),
    });
  }
}

export async function runDueAutoStops() {
  await ensureAutoStopSchema();

  const now = new Date();
  const rows = await prisma.$queryRawUnsafe<AutoStopRow[]>(
    `SELECT
      a."id",
      a."sshRemoteId",
      s."name" AS "sshRemoteName",
      a."targetType"::text AS "targetType",
      a."scheduledAt",
      a."status"::text AS "status",
      a."executedAt",
      a."error",
      a."createdAt",
      a."updatedAt"
    FROM "AutoStop"
    a
    LEFT JOIN "SSHRemote" s ON s."id" = a."sshRemoteId"
    WHERE a."status" = 'PENDING'::"AutoStopStatus"
      AND a."scheduledAt" <= $1
    ORDER BY a."scheduledAt" ASC`,
    now,
  );

  for (const row of rows) {
    await executeAutoStop(row);
  }

  return {
    processed: rows.length,
  };
}

export async function listPendingAutoStops() {
  await hydrateAutoStopTimers();

  const rows = await getPendingAutoStops();

  return rows.map(serializeAutoStop);
}

export async function createAutoStops({
  targetType,
  sshRemoteIds,
  scheduledAt,
}: {
  targetType: AutoStopTargetType;
  sshRemoteIds: string[];
  scheduledAt: Date;
}) {
  await ensureAutoStopSchema();
  await hydrateAutoStopTimers();

  const now = new Date();
  const targetRows =
    targetType === "ALL_ACTIVE"
      ? [{ id: randomUUID(), sshRemoteId: null, targetType }]
      : sshRemoteIds.map((sshRemoteId) => ({
          id: randomUUID(),
          sshRemoteId,
          targetType,
        }));

  for (const row of targetRows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AutoStop" (
        "id",
        "sshRemoteId",
        "targetType",
        "scheduledAt",
        "status",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3::"AutoStopTargetType",
        $4,
        'PENDING'::"AutoStopStatus",
        $5,
        $5
      )`,
      row.id,
      row.sshRemoteId,
      row.targetType,
      scheduledAt,
      now,
    );

    scheduleAutoStopTimer({
      id: row.id,
      scheduledAt,
    });
  }

  const rows = await prisma.$queryRawUnsafe<AutoStopRow[]>(
    `SELECT
      a."id",
      a."sshRemoteId",
      s."name" AS "sshRemoteName",
      a."targetType"::text AS "targetType",
      a."scheduledAt",
      a."status"::text AS "status",
      a."executedAt",
      a."error",
      a."createdAt",
      a."updatedAt"
    FROM "AutoStop"
    a
    LEFT JOIN "SSHRemote" s ON s."id" = a."sshRemoteId"
    WHERE a."id" = ANY($1::text[])
    ORDER BY a."scheduledAt" ASC`,
    targetRows.map((row) => row.id),
  );

  return rows.map(serializeAutoStop);
}

export async function cancelAutoStops(ids: string[]) {
  await ensureAutoStopSchema();

  const timers = getTimers();

  for (const id of ids) {
    const timer = timers.get(id);

    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "AutoStop"
     SET
      "status" = 'CANCELED'::"AutoStopStatus",
      "updatedAt" = $2
     WHERE "status" = 'PENDING'::"AutoStopStatus"
      AND "id" = ANY($1::text[])`,
    ids,
    new Date(),
  );
}

import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma PostgreSQL adapter");
}

const pool = globalForPrisma.pool || new Pool({ connectionString: databaseUrl });
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["warn", "error"],
    transactionOptions: { timeout: 10_000 }
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Execute a raw query to set RLS context for a user.
 * Must be called at the start of each transaction to enable RLS.
 */
const setRlsContext = async (tx: any, userId: string) => {
  await tx.$executeRawUnsafe(
    `SELECT set_config('request.jwt.claims', '{"sub":"${userId}"}', true)`
  );
};

const userIdModels = new Set(["items", "accounts", "transactions", "system_logs", "tags", "budget_rules"]);
const nonUniqueWhereOps = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany"
]);
const uniqueWhereOps = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const mergeWhere = (where: unknown, scope: Record<string, unknown>) =>
  where ? { AND: [where, scope] } : scope;

/**
 * Creates a user-scoped Prisma client that respects Row Level Security (RLS).
 * 
 * This client provides two layers of protection:
 * 1. Application-level filtering: Automatically adds user_id filters to queries
 * 2. Database-level RLS: Uses transactions with RLS context when needed
 * 
 * By default, queries use application-level filtering for better performance.
 * For operations requiring strict database-level RLS enforcement, use the
 * $transaction method with setRlsContext.
 * 
 * @param userId - The authenticated user's UUID
 * @returns Extended Prisma client with user-scoping and RLS support
 */
export const createUserScopedClient = (userId: string) => {
  const extended = prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !args || typeof args !== "object") return query(args);

          if (model === "users") {
            if (nonUniqueWhereOps.has(operation)) args.where = mergeWhere(args.where, { id: userId });
            if (uniqueWhereOps.has(operation)) args.where = { ...(args.where ?? {}), id: userId };
          }

          if (userIdModels.has(model)) {
            if (nonUniqueWhereOps.has(operation)) args.where = mergeWhere(args.where, { user_id: userId });
            if (uniqueWhereOps.has(operation)) args.where = { ...(args.where ?? {}), user_id: userId };
            if (operation === "create" && args.data && typeof args.data === "object") {
              args.data.user_id = userId;
            }
            if (operation === "upsert" && args.create && typeof args.create === "object") {
              args.create.user_id = userId;
            }
            if (operation === "createMany") {
              if (Array.isArray(args.data)) args.data = args.data.map((row: any) => ({ ...row, user_id: userId }));
              else if (args.data && typeof args.data === "object") args.data.user_id = userId;
            }
          }

          return query(args);
        }
      }
    }
  });

  return Object.assign(extended, {
    /**
     * Execute operations within a transaction with RLS context.
     * Use this when you need database-level RLS enforcement.
     * 
     * @example
     * await req.prisma.$withRls(async (tx) => {
     *   const items = await tx.items.findMany();
     *   return items;
     * });
     */
    $withRls: async <T>(operation: (tx: any) => Promise<T>): Promise<T> => {
      return prisma.$transaction(async (tx) => {
        await setRlsContext(tx, userId);
        return operation(tx);
      });
    }
  });
};

export type UserScopedPrisma = ReturnType<typeof createUserScopedClient>;

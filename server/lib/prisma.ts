import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma PostgreSQL adapter");
}
const adapter = new PrismaPg({ connectionString: databaseUrl });

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

const userIdModels = new Set(["items", "accounts", "transactions", "system_logs", "tags", "budget_rules"]);
const whereOps = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert"
]);
const mergeWhere = (where: unknown, scope: Record<string, unknown>) =>
  where ? { AND: [where, scope] } : scope;

export const createUserScopedClient = (userId: string) =>
  prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !args || typeof args !== "object") return query(args);

          if (model === "users" && whereOps.has(operation)) {
            args.where = mergeWhere(args.where, { id: userId });
          }

          if (userIdModels.has(model)) {
            if (whereOps.has(operation)) args.where = mergeWhere(args.where, { user_id: userId });
            if (operation === "create" && args.data && typeof args.data === "object") {
              args.data.user_id = userId;
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

export type UserScopedPrisma = ReturnType<typeof createUserScopedClient>;

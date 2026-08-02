import pino from "pino";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./lib/prisma";

// Keys whose values are secrets, and string patterns that look like tokens
// (Plaid access/public/link tokens, Stripe keys, JWTs, bearer values).
const TOKEN_KEY_RE = /token|secret|api[-_]?key|authorization|password/i;
const TOKEN_VALUE_RE =
  /\b(access|public|link)-(sandbox|development|production)-[\w-]+\b|\b(sk|rk|pk|whsec)_[A-Za-z0-9]{8,}\b|\beyJ[\w-]+\.[\w-]+\.[\w-]+\b|\bBearer\s+\S+/g;

export function redactTokens<T>(value: T): T {
  if (typeof value === "string") return value.replace(TOKEN_VALUE_RE, "[REDACTED]") as T;
  if (Array.isArray(value)) return value.map(redactTokens) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, any>).map(([k, v]) => [
        k,
        TOKEN_KEY_RE.test(k) && v != null ? "[REDACTED]" : redactTokens(v)
      ])
    ) as T;
  }
  return value;
}

const levelMap: Record<string, number> = {
  TRACE: 5,
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50
};

export class Logger {
  private readonly prisma: PrismaClient;
  private readonly logger: pino.Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const prettyLogs = String(process.env.PRETTY_LOGS || "").toLowerCase() === "true";
    this.logger = pino({
      base: null,
      level: process.env.LOG_LEVEL || "info",
      transport: prettyLogs
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined
    });
  }

  log(level: string, message: string, ...args: any[]): void {
    const target = (this.logger as any)[level] || this.logger.info;
    if (args.length > 0) {
      target.call(this.logger, { args }, message);
    } else {
      target.call(this.logger, message);
    }
  }

  async to_db(
    level: string,
    user_id: string,
    type: string,
    metadata?: Record<string, any>,
    raw_payload?: Record<string, any>
  ): Promise<void> {
    const levelValue = levelMap[level.toUpperCase()] ?? levelMap.INFO;
    await this.prisma.system_logs.create({
      data: {
        user_id,
        type,
        level: levelValue,
        metadata: metadata ? redactTokens(metadata) : undefined,
        raw_payload: raw_payload ? redactTokens(raw_payload) : undefined
      }
    });
  }
}

export const logger = new Logger(prisma);

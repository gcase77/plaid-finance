import pino from "pino";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./lib/prisma";

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
        metadata: metadata ?? undefined,
        raw_payload: raw_payload ?? undefined
      }
    });
  }
}

export const logger = new Logger(prisma);

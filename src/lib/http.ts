import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logError } from "@/lib/logger";

function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => jsonSafe(item));
  }

  if (typeof value === "object") {
    if ("toNumber" in value && typeof value.toNumber === "function") {
      return value.toNumber();
    }

    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = jsonSafe(item);
    }

    return output;
  }

  return value;
}

export async function withApiHandler<T>(handler: () => Promise<T>) {
  try {
    const result = await handler();

    if (result instanceof NextResponse) return result;

    return NextResponse.json(jsonSafe(result));
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status }
      );
    }

    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const fieldPath = firstIssue?.path?.join(".") ?? "payload";
      const fieldMessage = firstIssue?.message ?? "valor inválido";

      return NextResponse.json(
        {
          message: `Payload inválido em ${fieldPath}: ${fieldMessage}`,
          issues: error.issues
        },
        { status: 422 }
      );
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          message: "Serviço temporariamente indisponível",
          code: "SERVICE_UNAVAILABLE"
        },
        { status: 503 }
      );
    }

    logError("Unhandled API error", { error: String(error) });

    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}
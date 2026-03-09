import { NextResponse } from "next/server";

function hasRequiredEnv() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.DIRECT_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "lessul-go-atendimento",
      requiredEnvConfigured: hasRequiredEnv(),
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}

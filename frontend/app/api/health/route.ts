import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "architect-hub-frontend",
    checkedAt: new Date().toISOString(),
  });
}

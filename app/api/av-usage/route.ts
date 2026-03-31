import { NextResponse } from "next/server";
import { getAvUsage } from "@/lib/avTracker";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAvUsage());
}

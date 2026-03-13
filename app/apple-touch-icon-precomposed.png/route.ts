import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL("/apple-touch-icon.png", request.url);
  return NextResponse.redirect(url, 308);
}

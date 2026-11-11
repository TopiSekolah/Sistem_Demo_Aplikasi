import { NextResponse } from "next/server";
export async function POST() {
  const response = NextResponse.json({ message: "Berhasil keluar." });
  response.cookies.set("demo_token", "", { httpOnly: true, path: "/", expires: new Date(0) });
  return response;
}

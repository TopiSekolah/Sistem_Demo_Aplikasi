import { NextResponse } from "next/server";
export async function POST(request) {
  try {
    const credentials = await request.json();
    const upstream = await fetch(`${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials), cache: "no-store"
    });
    const data = await upstream.json();
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
    const response = NextResponse.json({ user: data.user });
    response.cookies.set("demo_token", data.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 8 * 60 * 60
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Tidak bisa menghubungi backend. Pastikan ASP.NET berjalan di port 5000." }, { status: 503 });
  }
}

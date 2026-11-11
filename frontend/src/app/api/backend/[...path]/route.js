import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function relay(request, context) {
  const token = (await cookies()).get("demo_token")?.value;
  if (!token) return NextResponse.json({ message: "Sesi tidak ditemukan. Masuk kembali." }, { status: 401 });
  const { path } = await context.params;
  const apiPath = path.map(encodeURIComponent).join("/");
  const search = new URL(request.url).search;
  const upstreamUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/${apiPath}${search}`;
  const headers = { Authorization: `Bearer ${token}` };
  const mime = request.headers.get("content-type");
  if (mime) headers["Content-Type"] = mime;
  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(upstreamUrl, {
      method: request.method, headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      cache: "no-store", redirect: "manual"
    });
    const responseHeaders = new Headers();
    for (const key of ["content-type", "content-disposition", "cache-control"]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    responseHeaders.set("Cache-Control", "no-store");
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ message: "Backend tidak dapat dihubungi." }, { status: 503 });
  }
}
export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;

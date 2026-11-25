import { readUpload } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const f = readUpload(name);
  if (!f) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(f.body), {
    headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

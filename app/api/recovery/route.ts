import { handleRecovery } from "@/lib/sync/server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleRecovery(request);
  } catch {
    return Response.json({ ok: false, error: "Something went wrong. Try again shortly." }, { status: 500 });
  }
}

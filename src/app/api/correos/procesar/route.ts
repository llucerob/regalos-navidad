import { NextResponse, type NextRequest } from "next/server";
import { procesarCola } from "@/lib/correos/enviar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Procesa la cola de correos. Pensado para un cron (por ejemplo cada 10 minutos):
 *   Authorization: Bearer <CRON_SECRET>
 */
async function manejar(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(await procesarCola(25));
}

export const GET = manejar;
export const POST = manejar;

import { NextResponse, type NextRequest } from "next/server";
import { obtenerStaff } from "@/lib/auth";
import { resolverCampana } from "@/lib/datos";
import { generarExportacion } from "@/lib/exportar";
import type { Estado } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ESTADOS: Estado[] = ["recibida", "en_revision", "observada", "aprobada", "rechazada"];

export async function GET(req: NextRequest) {
  const staff = await obtenerStaff();
  if (!staff || staff.perfil.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const p = req.nextUrl.searchParams;
  const campana = await resolverCampana(p.get("campana") ?? undefined);
  if (!campana) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const pedidos = (p.getAll("estados").length ? p.getAll("estados").flatMap((e) => e.split(",")) : ["aprobada"]).filter((e): e is Estado => ESTADOS.includes(e as Estado));
  const estados = pedidos.length ? pedidos : (["aprobada"] as Estado[]);
  const formato = p.get("formato") === "csv" ? "csv" : "xlsx";

  const { buffer, nombre, mime } = await generarExportacion(campana, estados, formato);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}

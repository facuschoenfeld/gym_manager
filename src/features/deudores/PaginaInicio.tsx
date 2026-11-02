/**
 * Pantalla de inicio. En la fase 0 solo verifica que la base esté creada y migrada;
 * en la fase 4 se convierte en el panel de deudores y contadores.
 */
import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { consultar } from "@/db/client";
import { leerConfig } from "@/db/queries/config";
import { Pagina } from "@/components/layout/Pagina";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearFecha, hoyISO } from "@/lib/fechas";

async function diagnostico() {
  const [config, planes, migraciones] = await Promise.all([
    leerConfig(),
    consultar<{ nombre: string }>("SELECT nombre FROM planes ORDER BY id"),
    consultar<{ version: number; description: string }>(
      "SELECT version, description FROM _sqlx_migrations ORDER BY version",
    ),
  ]);
  return { config, planes, migraciones };
}

export function PaginaInicio() {
  const { data, error, isPending } = useQuery({ queryKey: ["diagnostico"], queryFn: diagnostico });

  return (
    <Pagina titulo="Inicio" descripcion={`Hoy es ${formatearFecha(hoyISO())}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleCheck className="text-green-600" aria-hidden /> Base de datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-base">
          {isPending && <p>Cargando…</p>}
          {error && <p className="text-destructive">{String(error)}</p>}
          {data && (
            <>
              <p>
                Gimnasio: <strong>{data.config.nombre_gimnasio}</strong>
              </p>
              <p>Planes: {data.planes.map((p) => p.nombre).join(", ")}</p>
              <p>
                Migraciones aplicadas:{" "}
                {data.migraciones.map((m) => `${m.version} (${m.description})`).join(", ")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Pagina>
  );
}

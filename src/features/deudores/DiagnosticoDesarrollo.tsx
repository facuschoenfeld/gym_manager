/**
 * Diagnóstico técnico de la base (fase 0). Solo para desarrollo: se muestra en Inicio únicamente
 * con import.meta.env.DEV, dentro de un bloque plegado. El usuario final no lo ve.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consultar } from "@/db/client";
import { probarTransacciones } from "@/db/diagnostico";
import { leerConfig } from "@/db/queries/config";

/** Clave de TanStack Query del diagnóstico. Usar siempre esta constante. */
const CLAVE_DIAGNOSTICO = ["diagnostico"] as const;

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

export function DiagnosticoDesarrollo() {
  const { data, error, isPending } = useQuery({ queryKey: CLAVE_DIAGNOSTICO, queryFn: diagnostico });

  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-base font-medium">Diagnóstico (solo desarrollo)</summary>
      <div className="mt-4 flex flex-col gap-6">
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
        <PruebaTransacciones />
      </div>
    </details>
  );
}

/** Verifica que ejecutarLote confirme y deshaga correctamente. */
function PruebaTransacciones() {
  const prueba = useMutation({ mutationFn: probarTransacciones });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prueba de transacciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="lg" onClick={() => prueba.mutate()} disabled={prueba.isPending}>
          Ejecutar prueba
        </Button>
        {prueba.error && <p className="text-destructive">{String(prueba.error)}</p>}
        <ul className="space-y-1">
          {prueba.data?.map((r) => (
            <li key={r.nombre} className="flex items-start gap-2">
              {r.ok ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-green-600" aria-label="OK" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Falló" />
              )}
              <span>
                <strong>{r.nombre}</strong>: {r.detalle}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

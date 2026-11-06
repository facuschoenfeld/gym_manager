/**
 * Importar socios desde un Excel: elegir archivo, asignar columnas, revisar errores, confirmar y ver el resumen.
 * Nada se escribe en la base hasta confirmar, y la escritura es todo o nada (un solo lote).
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, FileSpreadsheet, Loader2, Download } from "lucide-react";
import { Confirmar } from "@/components/Confirmar";
import { Cargando, ErrorCarga } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { guardarConfig } from "@/db/queries/config";
import { listarClavesDePagosVigentes, ejecutarImportacion, type ResultadoImportacion } from "@/db/queries/importar";
import { listarSocios } from "@/db/queries/socios";
import { useConfig } from "@/features/configuracion/hooks";
import { usePlanes } from "@/features/planes/hooks";
import { cn } from "@/lib/utils";
import { guardarArchivo, generarPlantilla, generarRechazados, leerPrimeraHoja } from "./excel";
import {
  camposRepetidos,
  CAMPOS_IMPORTABLES,
  contextoImportacion,
  detectarMapeo,
  ETIQUETA_CAMPO,
  guardarMapeo,
  leerMapeoGuardado,
  mapeoTieneNombre,
  planificarAcciones,
  validarArchivo,
  type CampoImportable,
  type FilaImportacion,
  type FilaValidada,
  type MapeoColumnas,
} from "./logica/importar";

const FILAS_VISTA_PREVIA = 10;
const EXTENSION_ACEPTADA = ".xlsx";

interface ArchivoCargado {
  nombre: string;
  encabezados: string[];
  filas: FilaImportacion[];
}

export function PaginaImportar() {
  const config = useConfig();
  const planes = usePlanes();
  const qc = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [archivo, setArchivo] = useState<ArchivoCargado | null>(null);
  const [mapeo, setMapeo] = useState<MapeoColumnas>([]);
  const [revision, setRevision] = useState<FilaValidada[] | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [rechazadasFinal, setRechazadasFinal] = useState<FilaValidada[]>([]);
  const [encabezadosFinal, setEncabezadosFinal] = useState<string[]>([]);

  if (config.isPending || planes.isPending) return <Pagina titulo="Importar Excel"><Cargando /></Pagina>;
  if (config.error || planes.error) {
    return (
      <Pagina titulo="Importar Excel">
        <ErrorCarga
          error={config.error ?? planes.error}
          reintentar={() => {
            void config.refetch();
            void planes.refetch();
          }}
        />
      </Pagina>
    );
  }
  const cfg = config.data;
  const listaPlanes = planes.data ?? [];

  const cambiarArchivo = async (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(EXTENSION_ACEPTADA)) {
      avisar.advertencia("Elegí un archivo .xlsx", { descripcion: "Si tenés un .xls o .csv, guardalo como Excel (.xlsx)." });
      return;
    }
    setCargando(true);
    try {
      const { encabezados, filas } = await leerPrimeraHoja(await f.arrayBuffer());
      if (encabezados.length === 0 || filas.length === 0) {
        avisar.advertencia("El archivo no tiene datos", { descripcion: "La primera fila tiene que tener los encabezados y debajo los socios." });
        return;
      }
      setArchivo({ nombre: f.name, encabezados, filas });
      setMapeo(leerMapeoGuardado(cfg.mapeo_importacion, encabezados) ?? detectarMapeo(encabezados));
      setRevision(null);
      setResultado(null);
    } catch (e) {
      avisar.error("No se pudo leer el archivo", e);
    } finally {
      setCargando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const cambiarColumna = (indice: number, valor: string) => {
    setMapeo((m) => m.map((c, i) => (i === indice ? (valor === "" ? null : (valor as CampoImportable)) : c)));
    setRevision(null);
  };

  const revisar = () => {
    if (!archivo) return;
    setRevision(validarArchivo(archivo.filas, mapeo, contextoImportacion(cfg.codigo_area, listaPlanes)));
  };

  const repetidos = camposRepetidos(mapeo);
  const validas = revision?.filter((r) => r.socio !== null) ?? [];
  const conError = revision?.filter((r) => r.errores.length > 0) ?? [];
  const conAviso = revision?.filter((r) => r.avisos.length > 0) ?? [];

  const importar = async () => {
    if (!archivo || !revision) return;
    setImportando(true);
    try {
      const [pagos, existentes] = await Promise.all([listarClavesDePagosVigentes(), listarSocios()]);
      const plan = planificarAcciones(validas, existentes);
      const res = await ejecutarImportacion(plan.acciones, pagos);
      // Filas válidas que no se pudieron asignar a un socio: quedan como no importadas, con su motivo.
      const filasConflicto = plan.conflictos.flatMap((c) => {
        const fila = revision.find((r) => r.numero === c.numero);
        return fila ? [{ ...fila, errores: [...fila.errores, c.motivo] }] : [];
      });
      // Recordar el mapeo para la próxima vez (no bloquea el resumen si falla).
      await guardarConfig({ mapeo_importacion: guardarMapeo(archivo.encabezados, mapeo) }).catch((e: unknown) =>
        avisar.error("La importación se hizo, pero no se guardó el mapeo de columnas", e),
      );
      setResultado(res);
      setRechazadasFinal([...conError, ...filasConflicto]);
      setEncabezadosFinal(archivo.encabezados);
      setConfirmarAbierto(false);
      setArchivo(null);
      setRevision(null);
      void qc.invalidateQueries();
      avisar.exito("Importación terminada", {
        descripcion: `${res.creados} nuevos y ${res.actualizados} actualizados.`,
      });
    } catch (e) {
      avisar.error("No se pudo importar. No se guardó ningún socio", e);
    } finally {
      setImportando(false);
    }
  };

  const descargarPlantilla = async () => {
    try {
      await guardarArchivo(await generarPlantilla(), "plantilla_socios.xlsx");
    } catch (e) {
      avisar.error("No se pudo guardar la plantilla", e);
    }
  };

  const descargarRechazadas = async () => {
    try {
      const ok = await guardarArchivo(await generarRechazados(encabezadosFinal, rechazadasFinal), "socios_con_error.xlsx");
      if (ok) avisar.exito("Archivo guardado", { descripcion: "Corregí las filas y volvé a importarlo." });
    } catch (e) {
      avisar.error("No se pudo guardar el archivo de errores", e);
    }
  };

  return (
    <Pagina
      titulo="Importar Excel"
      descripcion="Cargá socios desde una planilla. Nada se guarda hasta que confirmes."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">1. Elegí el archivo</CardTitle>
          <CardDescription className="text-base">
            Excel (.xlsx). La primera fila tiene que tener los nombres de las columnas. Si no tenés una planilla lista,
            bajá la plantilla de ejemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => entrada.current?.click()} disabled={cargando || importando}>
            {cargando ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
            {cargando ? "Leyendo archivo…" : archivo ? "Elegir otro archivo" : "Elegir archivo Excel"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => void descargarPlantilla()}>
            <Download aria-hidden /> Descargar plantilla
          </Button>
          {archivo && (
            <p className="flex items-center gap-2 text-base font-medium">
              <FileSpreadsheet className="size-5" aria-hidden /> {archivo.nombre} · {archivo.filas.length} filas con datos
            </p>
          )}
          <input
            ref={entrada}
            type="file"
            accept={EXTENSION_ACEPTADA}
            className="hidden"
            onChange={(e) => void cambiarArchivo(e.target.files?.[0])}
          />
        </CardContent>
      </Card>

      {archivo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">2. Revisá qué columna es cada dato</CardTitle>
            <CardDescription className="text-base">
              Elegí en cada columna qué dato contiene, o "No importar". Se recuerda para la próxima vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!mapeoTieneNombre(mapeo) && (
              <p role="alert" className="flex items-center gap-2 text-base font-medium text-red-800 dark:text-red-300">
                <CircleAlert className="size-5" aria-hidden /> Falta asignar la columna Nombre.
              </p>
            )}
            {repetidos.length > 0 && (
              <p role="alert" className="flex items-center gap-2 text-base font-medium text-red-800 dark:text-red-300">
                <CircleAlert className="size-5" aria-hidden /> Hay datos asignados a dos columnas:{" "}
                {repetidos.map((c) => ETIQUETA_CAMPO[c]).join(", ")}. Dejá solo una columna para cada dato.
              </p>
            )}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Vista previa del archivo">
              <Table>
                <TableHeader>
                  <TableRow>
                    {archivo.encabezados.map((h, i) => (
                      <TableHead key={i} className="min-w-44 align-top">
                        <span className="flex flex-col gap-2">
                          <span className="text-muted-foreground">{h || `Columna ${i + 1}`}</span>
                          <select
                            aria-label={`Dato que contiene la columna ${h || i + 1}`}
                            value={mapeo[i] ?? ""}
                            onChange={(e) => cambiarColumna(i, e.target.value)}
                            className="h-11 rounded-md border-2 border-foreground/50 bg-background px-3 text-base font-normal text-foreground focus-visible:ring-3 focus-visible:ring-ring outline-none dark:[color-scheme:dark]"
                          >
                            <option value="">No importar</option>
                            {CAMPOS_IMPORTABLES.map((c) => (
                              <option key={c} value={c}>
                                {ETIQUETA_CAMPO[c]}
                              </option>
                            ))}
                          </select>
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivo.filas.slice(0, FILAS_VISTA_PREVIA).map((f) => (
                    <TableRow key={f.numero}>
                      {archivo.encabezados.map((_, i) => (
                        <TableCell key={i} className={cn("max-w-56 truncate", mapeo[i] === null && "text-muted-foreground")}>
                          {formatearCelda(f.celdas[i])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-base text-muted-foreground">
              Mostrando las primeras {Math.min(FILAS_VISTA_PREVIA, archivo.filas.length)} filas.
            </p>
            <div>
              <Button size="lg" onClick={revisar} disabled={!mapeoTieneNombre(mapeo) || repetidos.length > 0}>
                Revisar datos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {revision && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">3. Resultado de la revisión</CardTitle>
            <CardDescription className="text-base">
              Las filas con error no se importan. Podés corregirlas en el Excel y volver a cargarlo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-4 text-lg">
              <span className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
                <CircleCheck className="size-5" aria-hidden /> {validas.length} listas para importar
              </span>
              <span className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
                <CircleAlert className="size-5" aria-hidden /> {conError.length} con error
              </span>
              <span className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
                {conAviso.length} con avisos
              </span>
            </div>

            {conError.length > 0 && (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Filas con error">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conError.map((r) => (
                      <TableRow key={r.numero}>
                        <TableCell className="font-medium">{r.numero}</TableCell>
                        <TableCell className="whitespace-normal">{r.errores.join("; ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {conAviso.length > 0 && (
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer text-base font-semibold">Ver avisos ({conAviso.length})</summary>
                <ul className="mt-3 flex flex-col gap-2 text-base">
                  {conAviso.map((r) => (
                    <li key={r.numero}>
                      Fila {r.numero}: {r.avisos.join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div>
              <Button size="lg" onClick={() => setConfirmarAbierto(true)} disabled={validas.length === 0 || importando}>
                Importar {validas.length} {validas.length === 1 ? "socio" : "socios"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card role="status">
          <CardHeader>
            <CardTitle className="text-xl">Importación terminada</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-lg">
            <ul className="flex flex-col gap-1">
              <li>Socios nuevos: <strong>{resultado.creados}</strong></li>
              <li>Socios actualizados: <strong>{resultado.actualizados}</strong></li>
              <li>Pagos cargados: <strong>{resultado.pagosCreados}</strong></li>
              {resultado.pagosOmitidos > 0 && (
                <li>Pagos omitidos (ya había un pago ese día): <strong>{resultado.pagosOmitidos}</strong></li>
              )}
              <li>Filas con error (no importadas): <strong>{rechazadasFinal.length}</strong></li>
            </ul>
            {rechazadasFinal.length > 0 && (
              <div>
                <Button variant="outline" size="lg" onClick={() => void descargarRechazadas()}>
                  <Download aria-hidden /> Descargar filas con error
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Confirmar
        abierto={confirmarAbierto}
        alCambiar={setConfirmarAbierto}
        titulo={`¿Importar ${validas.length} ${validas.length === 1 ? "socio" : "socios"}?`}
        descripcion={`Las filas con error (${conError.length}) no se importan. Los socios que ya existen (por DNI, o por nombre y apellido si no tienen DNI) se actualizan sin borrar lo que ya tienen. Los pagos quedan como importados y no se pueden borrar, solo anular.`}
        accion={{ texto: "Importar", alConfirmar: () => void importar() }}
        procesando={importando}
      />
    </Pagina>
  );
}

function formatearCelda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toLocaleDateString("es-AR");
  return String(valor);
}

/**
 * Listado de socios vencidos para imprimir. Solo se ve al imprimir (clases hidden / print:block):
 * en pantalla no aparece. Usa las mismas filas que el Excel, así los dos coinciden.
 */
import type { SocioConEstado } from "@/features/socios/logica/socio";
import type { FechaISO } from "@/lib/fechas";
import { formatearFecha } from "@/lib/fechas";
import { filasExcelDeudores } from "./logica/deudores";

interface Props {
  deudores: SocioConEstado[];
  hoy: FechaISO;
  nombreGimnasio: string;
}

export function ListadoDeudoresImprimible({ deudores, hoy, nombreGimnasio }: Props) {
  const filas = filasExcelDeudores(deudores, hoy);
  const encabezado = filas[0] ?? [];
  const cuerpo = filas.slice(1);

  return (
    <section aria-label="Listado de socios vencidos para imprimir" className="hidden text-black print:block">
      <h1 className="text-2xl font-bold">Socios vencidos</h1>
      <p className="text-base">
        {nombreGimnasio} · Al {formatearFecha(hoy)} · {deudores.length} {deudores.length === 1 ? "vencido" : "vencidos"}
      </p>
      {cuerpo.length === 0 ? (
        <p className="mt-4 text-base">No hay socios vencidos.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              {encabezado.map((h) => (
                <th key={h} scope="col" className="border border-black px-2 py-1 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cuerpo.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className="border border-black px-2 py-1 align-top">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

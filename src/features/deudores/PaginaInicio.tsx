/**
 * Pantalla de inicio: encabezado de bienvenida con el logo del gimnasio, el saludo y la fecha.
 * En la fase 4 se suma debajo el panel de deudores y contadores.
 */
import { Pagina } from "@/components/layout/Pagina";
import { DiagnosticoDesarrollo } from "./DiagnosticoDesarrollo";
import { EncabezadoBienvenida } from "./EncabezadoBienvenida";

export function PaginaInicio() {
  return (
    <Pagina titulo="Inicio">
      <EncabezadoBienvenida />
      {/* Fase 4: panel de deudores y contadores, debajo del encabezado. */}
      {import.meta.env.DEV && <DiagnosticoDesarrollo />}
    </Pagina>
  );
}

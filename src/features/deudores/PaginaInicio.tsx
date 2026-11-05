/**
 * Pantalla de inicio: encabezado de bienvenida con el logo del gimnasio y el saludo,
 * y debajo el panel de socios (contadores, ingresos del mes y deudores).
 */
import { Pagina } from "@/components/layout/Pagina";
import { DiagnosticoDesarrollo } from "./DiagnosticoDesarrollo";
import { EncabezadoBienvenida } from "./EncabezadoBienvenida";
import { PanelDeudores } from "./PanelDeudores";

export function PaginaInicio() {
  return (
    <Pagina titulo="Inicio">
      <EncabezadoBienvenida />
      <PanelDeudores />
      {import.meta.env.DEV && <DiagnosticoDesarrollo />}
    </Pagina>
  );
}

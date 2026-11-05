import { NavLink, Outlet, useNavigate } from "react-router";
import {
  FileSpreadsheet,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAtajos } from "@/components/atajos";
import { useTema } from "@/components/tema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ItemMenu {
  a: string;
  etiqueta: string;
  icono: LucideIcon;
}

const MENU: ItemMenu[] = [
  { a: "/", etiqueta: "Inicio", icono: LayoutDashboard },
  { a: "/socios", etiqueta: "Socios", icono: Users },
  { a: "/planes", etiqueta: "Planes", icono: Tags },
  { a: "/importar", etiqueta: "Importar Excel", icono: FileSpreadsheet },
  { a: "/configuracion", etiqueta: "Configuración", icono: Settings },
];

/** Estado de navegación que entienden las pantallas (ej. Socios enfoca el buscador o abre el alta). */
export interface EstadoNavegacion {
  accion?: "buscar" | "nuevo-socio";
}

export function Layout() {
  const { tema, alternarTema } = useTema();
  const navegar = useNavigate();

  useAtajos([
    { tecla: "f", ctrl: true, accion: () => navegar("/socios", { state: { accion: "buscar" } satisfies EstadoNavegacion }) },
    { tecla: "/", accion: () => navegar("/socios", { state: { accion: "buscar" } satisfies EstadoNavegacion }) },
    { tecla: "n", ctrl: true, accion: () => navegar("/socios", { state: { accion: "nuevo-socio" } satisfies EstadoNavegacion }) },
    // Ctrl+T (registrar pago) lo maneja la ficha del socio. Acá solo se bloquean la acción nativa
    // (nueva pestaña) y Ctrl+P (imprimir), que no hace falta en esta app hasta la vista de impresión.
    { tecla: "t", ctrl: true, accion: () => undefined },
    { tecla: "p", ctrl: true, accion: () => undefined },
  ]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <a
        href="#contenido"
        onClick={(e) => {
          // Con HashRouter el hash es la ruta: no cambiarlo, solo mover el foco.
          e.preventDefault();
          document.getElementById("contenido")?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground print:hidden">
        <div className="flex items-center gap-2 px-5 py-6">
          {/* Marca fija de la app: el SVG original sin su fondo blanco (el relleno del brazo queda igual).
              Es decorativa: el nombre de al lado ya la identifica. */}
          <img src="/icono_gym-manager-sin-fondo.svg" alt="" className="size-9 shrink-0" />
          <span className="text-lg font-semibold">GYM MANAGER</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Secciones">
          {MENU.map(({ a, etiqueta, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === "/"}
              className={({ isActive }) =>
                cn(
                  // Borde izquierdo: indica la sección activa sin depender solo del color.
                  "flex items-center gap-3 rounded-lg border-l-4 px-3 py-3 text-base font-medium transition-colors",
                  "outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  isActive
                    ? "border-sidebar-primary-foreground/80 bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                    : "border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icono className="size-5" aria-hidden />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={alternarTema}>
            {tema === "claro" ? <Moon aria-hidden /> : <Sun aria-hidden />}
            {tema === "claro" ? "Modo oscuro" : "Modo claro"}
          </Button>
        </div>
      </aside>
      <main id="contenido" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <Outlet />
      </main>
    </div>
  );
}

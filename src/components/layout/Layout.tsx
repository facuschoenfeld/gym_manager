import { NavLink, Outlet } from "react-router";
import {
  Dumbbell,
  FileSpreadsheet,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
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

export function Layout() {
  const { tema, alternarTema } = useTema();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground print:hidden">
        <div className="flex items-center gap-2 px-5 py-6">
          <Dumbbell className="size-7 text-primary" aria-hidden />
          <span className="text-lg font-semibold">Gym Manager</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Secciones">
          {MENU.map(({ a, etiqueta, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icono className="size-5" aria-hidden />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={alternarTema}>
            {tema === "claro" ? <Moon aria-hidden /> : <Sun aria-hidden />}
            {tema === "claro" ? "Modo oscuro" : "Modo claro"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

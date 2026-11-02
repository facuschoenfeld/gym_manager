/** Tema claro/oscuro. Se guarda en localStorage para aplicarlo antes de abrir la base. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "claro" | "oscuro";

const CLAVE = "gym-manager:tema";

interface ContextoTema {
  tema: Tema;
  cambiarTema: (t: Tema) => void;
  alternarTema: () => void;
}

const Contexto = createContext<ContextoTema | null>(null);

function temaInicial(): Tema {
  return localStorage.getItem(CLAVE) === "oscuro" ? "oscuro" : "claro";
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    localStorage.setItem(CLAVE, tema);
  }, [tema]);

  const alternarTema = useCallback(() => setTema((t) => (t === "claro" ? "oscuro" : "claro")), []);

  return (
    <Contexto.Provider value={{ tema, cambiarTema: setTema, alternarTema }}>{children}</Contexto.Provider>
  );
}

export function useTema(): ContextoTema {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useTema debe usarse dentro de <ProveedorTema>");
  return ctx;
}

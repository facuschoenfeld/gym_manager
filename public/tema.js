// Aplica el tema guardado antes de pintar, para evitar un parpadeo blanco.
// (Archivo aparte y no inline para respetar la política de seguridad CSP.)
if (localStorage.getItem("gym-manager:tema") === "oscuro") {
  document.documentElement.classList.add("dark");
}

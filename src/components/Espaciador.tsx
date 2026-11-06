/**
 * Fila vacía que ocupa el alto de las filas que no están montadas (ver useVirtualFilas).
 * Sin esto, la barra de scroll saltaría al desplazarse.
 */
export function Espaciador({ alto, columnas }: { alto: number; columnas: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={columnas} className="p-0" style={{ height: alto }} />
    </tr>
  );
}

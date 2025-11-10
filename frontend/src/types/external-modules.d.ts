/**
 * Declarações auxiliares para módulos sem tipagem oficial.
 * Mantém o TypeScript silencioso até que instalemos os tipos definitivos.
 */
declare module "file-saver" {
  export function saveAs(data: Blob, filename?: string, options?: unknown): void;
}

declare module "xlsx";

declare module "jspdf";
declare module "jspdf-autotable";


"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { Card, buttonVariants } from "@heroui/react";
import { CampoSelect } from "@/components/campo-select";
import { apiFetch } from "@/lib/cliente-api";
import { cn } from "@/lib/utils";

interface Almacen {
  id: string;
  nombre: string;
  estancias: { id: string; nombre: string; estanterias: { id: string; codigo: string }[] }[];
}

/**
 * Exportación de informes por estantería o por todo el almacén, en Excel,
 * CSV (para el ERP) y PDF (para archivo).
 */
export default function PaginaInformes() {
  const { data } = useQuery({
    queryKey: ["almacenes"],
    queryFn: () => apiFetch<{ almacenes: Almacen[] }>("/api/almacenes"),
  });

  const [ambito, setAmbito] = useState<"almacen" | "estanteria">("almacen");
  const [almacenId, setAlmacenId] = useState<string>("todos");
  const [estanteriaId, setEstanteriaId] = useState<string | null>(null);
  const [soloFinalizados, setSoloFinalizados] = useState(true);

  const estanterias =
    data?.almacenes.flatMap((a) =>
      a.estancias.flatMap((e) =>
        e.estanterias.map((est) => ({ ...est, etiqueta: `${a.nombre} · ${e.nombre} · ${est.codigo}` }))
      )
    ) ?? [];

  function urlInforme(formato: string): string {
    const params = new URLSearchParams({ formato });
    if (ambito === "almacen" && almacenId !== "todos") params.set("almacenId", almacenId);
    if (ambito === "estanteria" && estanteriaId) params.set("estanteriaId", estanteriaId);
    if (soloFinalizados) params.set("soloFinalizados", "1");
    return `/api/informes?${params.toString()}`;
  }

  const listo = ambito === "almacen" ? true : estanteriaId !== null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Informes</h1>
        <p className="mt-1 text-sm text-muted">
          Descarga el recuento listo para importar en el ERP. Las incidencias resueltas ya
          aparecen integradas como líneas normales.
        </p>
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Ámbito del informe</Card.Title>
          <Card.Description>Todo un almacén o una estantería concreta.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <CampoSelect
            label="Ámbito"
            valor={ambito}
            onCambio={(v) => setAmbito(v as typeof ambito)}
            opciones={[
              { valor: "almacen", etiqueta: "Todo el almacén" },
              { valor: "estanteria", etiqueta: "Una estantería" },
            ]}
          />

          {ambito === "almacen" ? (
            <CampoSelect
              label="Almacén"
              valor={almacenId}
              onCambio={setAlmacenId}
              opciones={[
                { valor: "todos", etiqueta: "Todos los almacenes" },
                ...(data?.almacenes.map((a) => ({ valor: a.id, etiqueta: a.nombre })) ?? []),
              ]}
            />
          ) : (
            <CampoSelect
              label="Estantería"
              placeholder="Elige una estantería"
              valor={estanteriaId}
              onCambio={setEstanteriaId}
              opciones={estanterias.map((e) => ({ valor: e.id, etiqueta: e.etiqueta }))}
            />
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soloFinalizados}
              onChange={(e) => setSoloFinalizados(e.target.checked)}
              className="h-4 w-4 min-h-0 accent-(--accent)"
            />
            Incluir solo recuentos finalizados y firmados
          </label>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Descargar</Card.Title>
          <Card.Description>
            El informe incluye ubicación, estantería, estancia, artículo, cantidad, unidad,
            operario, NBI, fecha y estado.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-wrap gap-3">
          <a
            href={listo ? urlInforme("xlsx") : undefined}
            download
            aria-disabled={!listo}
            className={cn(buttonVariants({ variant: "primary" }), !listo && "pointer-events-none opacity-50")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel (.xlsx)
          </a>
          <a
            href={listo ? urlInforme("csv") : undefined}
            download
            aria-disabled={!listo}
            className={cn(buttonVariants({ variant: "outline" }), !listo && "pointer-events-none opacity-50")}
          >
            <FileDown className="h-4 w-4" />
            CSV para ERP
          </a>
          <a
            href={listo ? urlInforme("pdf") : undefined}
            download
            aria-disabled={!listo}
            className={cn(buttonVariants({ variant: "outline" }), !listo && "pointer-events-none opacity-50")}
          >
            <FileText className="h-4 w-4" />
            PDF
          </a>
        </Card.Content>
      </Card>
    </div>
  );
}

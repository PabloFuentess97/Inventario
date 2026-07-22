"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge, RefreshCw, Split } from "lucide-react";
import { Button, Card, Chip, Input, Label, Tabs, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { CampoSelect } from "@/components/campo-select";
import { apiFetch } from "@/lib/cliente-api";
import { formatearCantidad } from "@/lib/utils";

interface Grupo {
  id: string;
  descripcionCanonica: string | null;
  estado: "PENDIENTE" | "UNIFICADO" | "SEPARADO";
  lineas: {
    linea: {
      id: string;
      descripcionArticulo: string;
      cantidad: string;
      unidadMedida: { codigo: string } | null;
      recuento: {
        ubicacion: { codigo: string; estanteria: { codigo: string; estancia: { nombre: string } } };
      };
    };
  }[];
}

/**
 * Revisión de similitudes: la app agrupa descripciones parecidas (pg_trgm)
 * y la oficina decide si son el mismo artículo (unificar con una descripción
 * canónica) o artículos distintos (separar).
 */
export default function PaginaSimilitudes() {
  const [filtro, setFiltro] = useState<"PENDIENTE" | "UNIFICADO" | "SEPARADO">("PENDIENTE");
  const [canonicas, setCanonicas] = useState<Record<string, string>>({});
  const [sensibilidad, setSensibilidad] = useState("0.4");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["similitudes", filtro],
    queryFn: () => apiFetch<{ grupos: Grupo[] }>(`/api/similitudes?estado=${filtro}`),
  });

  const generar = useMutation({
    mutationFn: () =>
      apiFetch<{ creados: number }>("/api/similitudes", {
        method: "POST",
        body: JSON.stringify({ umbral: parseFloat(sensibilidad) }),
      }),
    onSuccess: (r) => {
      toast.success(
        r.creados === 0
          ? "Análisis completado: no se encontraron nuevas similitudes"
          : `Análisis completado: ${r.creados} grupos sugeridos`
      );
      queryClient.invalidateQueries({ queryKey: ["similitudes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decidir = useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: Record<string, string> }) =>
      apiFetch(`/api/similitudes/${id}`, { method: "PATCH", body: JSON.stringify(cuerpo) }),
    onSuccess: () => {
      toast.success("Decisión guardada");
      queryClient.invalidateQueries({ queryKey: ["similitudes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Similitudes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CampoSelect
            className="w-64"
            ariaLabel="Sensibilidad del análisis"
            valor={sensibilidad}
            onCambio={setSensibilidad}
            opciones={[
              { valor: "0.3", etiqueta: "Sensibilidad alta (más sugerencias)" },
              { valor: "0.4", etiqueta: "Sensibilidad normal" },
              { valor: "0.55", etiqueta: "Sensibilidad estricta (muy parecidas)" },
            ]}
          />
          <Button onPress={() => generar.mutate()} isDisabled={generar.isPending}>
            <RefreshCw className={`h-4 w-4 ${generar.isPending ? "animate-spin" : ""}`} />
            Analizar descripciones
          </Button>
        </div>
      </div>

      <p className="max-w-3xl text-sm text-muted">
        El análisis agrupa líneas con descripciones parecidas (p. ej. «cuerpo de 105mm» y
        «vaso de 105mm») ignorando mayúsculas y acentos, mediante similitud de trigramas.
        Se ejecuta solo cada vez que un operario finaliza un recuento, y puedes relanzarlo
        aquí con la sensibilidad que prefieras. Revisa cada grupo: si es el mismo artículo
        con nombres distintos, unifícalo con la descripción correcta antes de exportar el
        informe al ERP. Las decisiones (unificar/separar) se recuerdan y no se vuelven a
        proponer.
      </p>

      <Tabs selectedKey={filtro} onSelectionChange={(k) => setFiltro(k as typeof filtro)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Filtrar grupos">
            <Tabs.Tab id="PENDIENTE">
              Pendientes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="UNIFICADO">
              Unificados
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="SEPARADO">
              Separados
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {isLoading && <p className="text-muted">Cargando…</p>}

      {data?.grupos.length === 0 && (
        <Card>
          <Card.Content className="p-8 text-center text-muted">
            {filtro === "PENDIENTE"
              ? "No hay grupos pendientes. Pulsa «Analizar descripciones» tras finalizar recuentos."
              : "Nada por aquí todavía."}
          </Card.Content>
        </Card>
      )}

      {data?.grupos.map((grupo) => (
        <Card key={grupo.id}>
          <Card.Header>
            <Card.Title className="text-base">
              Grupo de {grupo.lineas.length} líneas
              {grupo.estado !== "PENDIENTE" && (
                <Chip
                  size="sm"
                  color={grupo.estado === "UNIFICADO" ? "success" : "default"}
                  variant="soft"
                  className="ml-2"
                >
                  {grupo.estado === "UNIFICADO"
                    ? `Unificado: ${grupo.descripcionCanonica}`
                    : "Separado"}
                </Chip>
              )}
            </Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              {grupo.lineas.map(({ linea }) => (
                <div
                  key={linea.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-surface-secondary px-3 py-2 text-sm"
                >
                  <span className="font-medium">{linea.descripcionArticulo}</span>
                  <span className="text-muted">
                    {formatearCantidad(linea.cantidad)} {linea.unidadMedida?.codigo ?? ""} ·{" "}
                    {linea.recuento.ubicacion.estanteria.estancia.nombre} ·{" "}
                    {linea.recuento.ubicacion.codigo}
                  </span>
                </div>
              ))}
            </div>

            {grupo.estado === "PENDIENTE" && (
              <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-end">
                <TextField
                  fullWidth
                  className="flex-1"
                  value={canonicas[grupo.id] ?? grupo.descripcionCanonica ?? ""}
                  onChange={(v) => setCanonicas({ ...canonicas, [grupo.id]: v })}
                >
                  <Label>Descripción canónica (si se unifica)</Label>
                  <Input />
                </TextField>
                <div className="flex gap-2">
                  <Button
                    onPress={() =>
                      decidir.mutate({
                        id: grupo.id,
                        cuerpo: {
                          accion: "unificar",
                          descripcionCanonica:
                            (canonicas[grupo.id] ?? grupo.descripcionCanonica ?? "").trim(),
                        },
                      })
                    }
                    isDisabled={decidir.isPending}
                  >
                    <GitMerge className="h-4 w-4" />
                    Unificar
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => decidir.mutate({ id: grupo.id, cuerpo: { accion: "separar" } })}
                    isDisabled={decidir.isPending}
                  >
                    <Split className="h-4 w-4" />
                    Son distintos
                  </Button>
                </div>
              </div>
            )}
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}

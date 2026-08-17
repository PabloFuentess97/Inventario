"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveRestore,
  Boxes,
  ChevronDown,
  ChevronRight,
  Eye,
  FileUp,
  Grid3x3,
  Plus,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Button, Card, Chip, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/cliente-api";
import {
  DialogoBorrarEstructura,
  type ObjetivoBorrado,
  type TipoEstructura,
} from "@/components/oficina/dialogo-borrar-estructura";

interface Ubicacion {
  id: string;
  codigo: string;
  nivel: number | null;
  hueco: number | null;
  archivada: boolean;
}
interface Estanteria {
  id: string;
  codigo: string;
  descripcion: string | null;
  archivada: boolean;
  ubicaciones: Ubicacion[];
}
interface Estancia {
  id: string;
  codigo: string;
  nombre: string;
  archivada: boolean;
  estanterias: Estanteria[];
}
interface Almacen {
  id: string;
  nombre: string;
  descripcion: string | null;
  archivada: boolean;
  estancias: Estancia[];
}

type Dialogo =
  | { tipo: "almacen" }
  | { tipo: "estancia"; almacenId: string }
  | { tipo: "estanteria"; estanciaId: string }
  | { tipo: "ubicacion"; estanteriaId: string }
  | { tipo: "lote"; estanteriaId: string; estanteriaCodigo: string }
  | { tipo: "csv" }
  | null;

/**
 * Configuración de la estructura física del almacén:
 * Almacén → Estancias → Estanterías → Ubicaciones.
 * Sin artículos ni stock: solo se define dónde se contará.
 */
export default function PaginaEstructura() {
  const queryClient = useQueryClient();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [borrando, setBorrando] = useState<ObjetivoBorrado | null>(null);

  // Solo el administrador puede borrar o archivar estructura
  const { data: yo } = useQuery({
    queryKey: ["yo"],
    queryFn: () => apiFetch<{ rol: string }>("/api/yo"),
    staleTime: 5 * 60_000,
  });
  const esAdmin = yo?.rol === "ADMIN";

  const { data, isLoading } = useQuery({
    queryKey: ["almacenes", verArchivadas],
    queryFn: () =>
      apiFetch<{ almacenes: Almacen[] }>(
        "/api/almacenes" + (verArchivadas ? "?incluirArchivados=1" : "")
      ),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["almacenes"] });

  const restaurar = useMutation({
    mutationFn: ({ tipo, id }: { tipo: TipoEstructura; id: string }) =>
      apiFetch("/api/estructura/restaurar", {
        method: "POST",
        body: JSON.stringify({ tipo, id }),
      }),
    onSuccess: () => {
      toast.success("Restaurado: vuelve a estar disponible para los operarios");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Estructura del almacén</h1>
        <div className="flex flex-wrap gap-2">
          {esAdmin && (
            <Button variant="ghost" onPress={() => setVerArchivadas(!verArchivadas)}>
              <Eye className="h-4 w-4" />
              {verArchivadas ? "Ocultar archivadas" : "Ver archivadas"}
            </Button>
          )}
          <Button variant="outline" onPress={() => setDialogo({ tipo: "csv" })}>
            <FileUp className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button onPress={() => setDialogo({ tipo: "almacen" })}>
            <Plus className="h-4 w-4" />
            Nuevo almacén
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted">Cargando estructura…</p>}

      {data?.almacenes.length === 0 && (
        <Card>
          <Card.Content className="p-8 text-center text-muted">
            Aún no hay almacenes. Crea uno para empezar a definir estancias, estanterías y
            ubicaciones.
          </Card.Content>
        </Card>
      )}

      {data?.almacenes.map((almacen) => (
        <Card key={almacen.id}>
          <Card.Header className="flex flex-row flex-wrap items-center justify-between gap-2">
            <Card.Title className="flex flex-wrap items-center gap-2">
              <Warehouse className="h-5 w-5 text-accent" />
              {almacen.nombre}
              {almacen.descripcion && (
                <span className="text-sm font-normal text-muted">— {almacen.descripcion}</span>
              )}
              {almacen.archivada && (
                <Chip size="sm" color="warning" variant="soft">
                  Archivado
                </Chip>
              )}
            </Card.Title>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setDialogo({ tipo: "estancia", almacenId: almacen.id })}
              >
                <Plus className="h-4 w-4" />
                Estancia
              </Button>
              {esAdmin && almacen.archivada && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => restaurar.mutate({ tipo: "almacen", id: almacen.id })}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  Restaurar
                </Button>
              )}
              {esAdmin && !almacen.archivada && (
                <Button
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  className="text-muted"
                  aria-label="Eliminar almacén"
                  onPress={() =>
                    setBorrando({ tipo: "almacen", id: almacen.id, etiqueta: almacen.nombre })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            {almacen.estancias.map((estancia) => (
              <NodoEstancia
                key={estancia.id}
                estancia={estancia}
                esAdmin={!!esAdmin}
                onNuevaEstanteria={() => setDialogo({ tipo: "estanteria", estanciaId: estancia.id })}
                onNuevaUbicacion={(estanteriaId) => setDialogo({ tipo: "ubicacion", estanteriaId })}
                onLote={(estanteriaId, codigo) =>
                  setDialogo({ tipo: "lote", estanteriaId, estanteriaCodigo: codigo })
                }
                onBorrar={setBorrando}
                onRestaurar={(tipo, id) => restaurar.mutate({ tipo, id })}
              />
            ))}
            {almacen.estancias.length === 0 && (
              <p className="text-sm text-muted">Sin estancias todavía.</p>
            )}
          </Card.Content>
        </Card>
      ))}

      <DialogosEstructura dialogo={dialogo} onCerrar={() => setDialogo(null)} onExito={invalidar} />
      <DialogoBorrarEstructura
        objetivo={borrando}
        onCerrar={() => setBorrando(null)}
        onExito={invalidar}
      />
    </div>
  );
}

function NodoEstancia({
  estancia,
  esAdmin,
  onNuevaEstanteria,
  onNuevaUbicacion,
  onLote,
  onBorrar,
  onRestaurar,
}: {
  estancia: Estancia;
  esAdmin: boolean;
  onNuevaEstanteria: () => void;
  onNuevaUbicacion: (estanteriaId: string) => void;
  onLote: (estanteriaId: string, codigo: string) => void;
  onBorrar: (objetivo: ObjetivoBorrado) => void;
  onRestaurar: (tipo: TipoEstructura, id: string) => void;
}) {
  const [abierta, setAbierta] = useState(true);

  return (
    <div className="rounded-lg border">
      {/* flex-wrap: en móvil los botones bajan a una segunda línea sin desbordar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <button
          className="flex min-w-0 flex-wrap items-center gap-2 text-left font-medium"
          onClick={() => setAbierta(!abierta)}
        >
          {abierta ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <Boxes className="h-4 w-4 shrink-0 text-muted" />
          {estancia.codigo} · {estancia.nombre}
          <Chip size="sm" variant="soft">
            {estancia.estanterias.length} estanterías
          </Chip>
          {estancia.archivada && (
            <Chip size="sm" color="warning" variant="soft">
              Archivada
            </Chip>
          )}
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onNuevaEstanteria}>
            <Plus className="h-4 w-4" />
            Estantería
          </Button>
          {esAdmin && estancia.archivada && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => onRestaurar("estancia", estancia.id)}
            >
              <ArchiveRestore className="h-4 w-4" />
              Restaurar
            </Button>
          )}
          {esAdmin && !estancia.archivada && (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="text-muted"
              aria-label="Eliminar estancia"
              onPress={() =>
                onBorrar({
                  tipo: "estancia",
                  id: estancia.id,
                  etiqueta: estancia.codigo,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {abierta && (
        <div className="flex flex-col gap-2 border-t p-3">
          {estancia.estanterias.map((estanteria) => (
            <NodoEstanteria
              key={estanteria.id}
              estanteria={estanteria}
              esAdmin={esAdmin}
              onNuevaUbicacion={() => onNuevaUbicacion(estanteria.id)}
              onLote={() => onLote(estanteria.id, estanteria.codigo)}
              onBorrar={onBorrar}
              onRestaurar={onRestaurar}
            />
          ))}
          {estancia.estanterias.length === 0 && (
            <p className="text-sm text-muted">Sin estanterías.</p>
          )}
        </div>
      )}
    </div>
  );
}

function NodoEstanteria({
  estanteria,
  esAdmin,
  onNuevaUbicacion,
  onLote,
  onBorrar,
  onRestaurar,
}: {
  estanteria: Estanteria;
  esAdmin: boolean;
  onNuevaUbicacion: () => void;
  onLote: () => void;
  onBorrar: (objetivo: ObjetivoBorrado) => void;
  onRestaurar: (tipo: TipoEstructura, id: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="rounded-md border bg-surface-secondary">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5">
        <button
          className="flex min-w-0 items-center gap-2 text-sm font-medium"
          onClick={() => setAbierta(!abierta)}
        >
          {abierta ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {estanteria.codigo}
          <Chip size="sm" variant="soft">
            {estanteria.ubicaciones.length} ubicaciones
          </Chip>
          {estanteria.archivada && (
            <Chip size="sm" color="warning" variant="soft">
              Archivada
            </Chip>
          )}
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onPress={onLote} aria-label="Generar ubicaciones en lote">
            <Grid3x3 className="h-4 w-4" />
            Generar
          </Button>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Nueva ubicación" onPress={onNuevaUbicacion}>
            <Plus className="h-4 w-4" />
          </Button>
          {esAdmin && estanteria.archivada && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => onRestaurar("estanteria", estanteria.id)}
            >
              <ArchiveRestore className="h-4 w-4" />
              Restaurar
            </Button>
          )}
          {esAdmin && !estanteria.archivada && (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              className="text-muted"
              aria-label="Eliminar estantería"
              onPress={() =>
                onBorrar({
                  tipo: "estanteria",
                  id: estanteria.id,
                  etiqueta: estanteria.codigo,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {abierta && (
        <div className="flex flex-wrap gap-1.5 border-t p-2.5">
          {estanteria.ubicaciones.map((u) => (
            <span
              key={u.id}
              className="group inline-flex items-center gap-1 rounded-md border bg-surface px-2 py-1 text-xs font-medium"
            >
              {u.codigo}
              {esAdmin && (
                <button
                  className="hidden text-muted hover:text-danger group-hover:inline"
                  onClick={() =>
                    onBorrar({ tipo: "ubicacion", id: u.id, etiqueta: u.codigo })
                  }
                  aria-label={`Eliminar ${u.codigo}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {estanteria.ubicaciones.length === 0 && (
            <p className="text-xs text-muted">Sin ubicaciones.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Diálogos de creación ─────────────────────────────────────────────────── */

function DialogosEstructura({
  dialogo,
  onCerrar,
  onExito,
}: {
  dialogo: Dialogo;
  onCerrar: () => void;
  onExito: () => void;
}) {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const campo = (k: string, porDefecto = "") => campos[k] ?? porDefecto;

  const crear = useMutation({
    mutationFn: async () => {
      if (!dialogo) return;
      switch (dialogo.tipo) {
        case "almacen":
          return apiFetch("/api/almacenes", {
            method: "POST",
            body: JSON.stringify({ nombre: campo("nombre"), descripcion: campo("descripcion") || null }),
          });
        case "estancia":
          return apiFetch("/api/estancias", {
            method: "POST",
            body: JSON.stringify({
              almacenId: dialogo.almacenId,
              codigo: campo("codigo"),
              nombre: campo("nombre"),
            }),
          });
        case "estanteria":
          return apiFetch("/api/estanterias", {
            method: "POST",
            body: JSON.stringify({
              estanciaId: dialogo.estanciaId,
              codigo: campo("codigo"),
              descripcion: campo("descripcion") || null,
            }),
          });
        case "ubicacion":
          return apiFetch("/api/ubicaciones", {
            method: "POST",
            body: JSON.stringify({
              estanteriaId: dialogo.estanteriaId,
              codigo: campo("codigo"),
              nivel: campo("nivel") ? parseInt(campo("nivel"), 10) : null,
              hueco: campo("hueco") ? parseInt(campo("hueco"), 10) : null,
            }),
          });
        case "lote":
          return apiFetch<{ creadas: number; total: number }>("/api/ubicaciones/lote", {
            method: "POST",
            body: JSON.stringify({
              estanteriaId: dialogo.estanteriaId,
              niveles: parseInt(campo("niveles", "3"), 10),
              huecos: parseInt(campo("huecos", "4"), 10),
              plantilla: campo("plantilla", "{EST}-N{N}-H{H}"),
            }),
          });
        case "csv":
          return apiFetch<{ procesadas: number; errores: string[] }>("/api/estructura/importar", {
            method: "POST",
            body: JSON.stringify({ csv: campo("csv") }),
          });
      }
    },
    onSuccess: (resultado: unknown) => {
      if (dialogo?.tipo === "lote" && resultado) {
        const r = resultado as { creadas: number; total: number };
        toast.success(`${r.creadas} ubicaciones creadas (${r.total - r.creadas} ya existían)`);
      } else if (dialogo?.tipo === "csv" && resultado) {
        const r = resultado as { procesadas: number; errores: string[] };
        toast.success(`${r.procesadas} filas importadas`);
        if (r.errores.length) toast.warning(`${r.errores.length} filas con errores`);
      } else {
        toast.success("Creado correctamente");
      }
      setCampos({});
      onCerrar();
      onExito();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const titulos: Record<string, string> = {
    almacen: "Nuevo almacén",
    estancia: "Nueva estancia",
    estanteria: "Nueva estantería",
    ubicacion: "Nueva ubicación",
    lote: "Generar ubicaciones en lote",
    csv: "Importar estructura desde CSV",
  };

  return (
    <Modal
      isOpen={dialogo !== null}
      onOpenChange={(o) => {
        if (!o) {
          setCampos({});
          onCerrar();
        }
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            {dialogo && (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>{titulos[dialogo.tipo]}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  {dialogo.tipo === "lote" && (
                    <p className="text-sm text-muted">
                      Se crearán niveles × huecos ubicaciones para la estantería{" "}
                      {dialogo.estanteriaCodigo}. La plantilla admite {"{EST}"}, {"{N}"} y {"{H}"}.
                    </p>
                  )}
                  {dialogo.tipo === "csv" && (
                    <p className="text-sm text-muted">
                      Cabecera esperada:
                      almacen;estancia_codigo;estancia_nombre;estanteria;ubicacion;nivel;hueco
                    </p>
                  )}

                  {(dialogo.tipo === "almacen" || dialogo.tipo === "estancia") && (
                    <TextField
                      fullWidth
                      value={campo("nombre")}
                      onChange={(v) => setCampos({ ...campos, nombre: v })}
                    >
                      <Label>Nombre</Label>
                      <Input />
                    </TextField>
                  )}
                  {(dialogo.tipo === "estancia" ||
                    dialogo.tipo === "estanteria" ||
                    dialogo.tipo === "ubicacion") && (
                    <TextField
                      fullWidth
                      value={campo("codigo")}
                      onChange={(v) => setCampos({ ...campos, codigo: v })}
                    >
                      <Label>Código</Label>
                      <Input placeholder={dialogo.tipo === "ubicacion" ? "E01-N1-H1" : "E01"} />
                    </TextField>
                  )}
                  {(dialogo.tipo === "almacen" || dialogo.tipo === "estanteria") && (
                    <TextField
                      fullWidth
                      value={campo("descripcion")}
                      onChange={(v) => setCampos({ ...campos, descripcion: v })}
                    >
                      <Label>Descripción (opcional)</Label>
                      <Input />
                    </TextField>
                  )}
                  {dialogo.tipo === "ubicacion" && (
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        value={campo("nivel")}
                        onChange={(v) => setCampos({ ...campos, nivel: v })}
                      >
                        <Label>Nivel</Label>
                        <Input type="number" />
                      </TextField>
                      <TextField
                        value={campo("hueco")}
                        onChange={(v) => setCampos({ ...campos, hueco: v })}
                      >
                        <Label>Hueco</Label>
                        <Input type="number" />
                      </TextField>
                    </div>
                  )}
                  {dialogo.tipo === "lote" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField
                          value={campo("niveles", "3")}
                          onChange={(v) => setCampos({ ...campos, niveles: v })}
                        >
                          <Label>Niveles</Label>
                          <Input type="number" min={1} />
                        </TextField>
                        <TextField
                          value={campo("huecos", "4")}
                          onChange={(v) => setCampos({ ...campos, huecos: v })}
                        >
                          <Label>Huecos por nivel</Label>
                          <Input type="number" min={1} />
                        </TextField>
                      </div>
                      <TextField
                        fullWidth
                        value={campo("plantilla", "{EST}-N{N}-H{H}")}
                        onChange={(v) => setCampos({ ...campos, plantilla: v })}
                      >
                        <Label>Plantilla de código</Label>
                        <Input />
                      </TextField>
                    </>
                  )}
                  {dialogo.tipo === "csv" && (
                    <>
                      <TextField
                        fullWidth
                        value={campo("csv")}
                        onChange={(v) => setCampos({ ...campos, csv: v })}
                      >
                        <Label>Contenido CSV</Label>
                        <TextArea
                          rows={10}
                          className="font-mono text-xs"
                          placeholder={
                            "almacen;estancia_codigo;estancia_nombre;estanteria;ubicacion;nivel;hueco\nAlmacén Central;Z1;Zona 1;E01;E01-N1-H1;1;1"
                          }
                        />
                      </TextField>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="text-sm"
                        onChange={async (e) => {
                          const archivo = e.target.files?.[0];
                          if (archivo) setCampos({ ...campos, csv: await archivo.text() });
                        }}
                      />
                    </>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="outline" onPress={onCerrar}>
                    Cancelar
                  </Button>
                  <Button onPress={() => crear.mutate()} isDisabled={crear.isPending}>
                    {dialogo.tipo === "csv" ? "Importar" : dialogo.tipo === "lote" ? "Generar" : "Crear"}
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

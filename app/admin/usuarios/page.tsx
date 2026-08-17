"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, Trash2, UserX, UserCheck } from "lucide-react";
import { Button, Chip, Input, Label, Modal, Table, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { CampoSelect } from "@/components/campo-select";
import { apiFetch } from "@/lib/cliente-api";

interface Usuario {
  id: string;
  nombre: string;
  nbi: string;
  email: string;
  rol: "OPERARIO" | "OFICINISTA" | "ADMIN";
  activo: boolean;
}

const ETIQUETAS_ROL: Record<Usuario["rol"], string> = {
  OPERARIO: "Operario",
  OFICINISTA: "Oficinista",
  ADMIN: "Administrador",
};

const OPCIONES_ROL = [
  { valor: "OPERARIO", etiqueta: "Operario" },
  { valor: "OFICINISTA", etiqueta: "Oficinista" },
  { valor: "ADMIN", etiqueta: "Administrador" },
];

/** Gestión de usuarios (solo administrador). El NBI es obligatorio: firma los recuentos. */
export default function PaginaUsuarios() {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [cambioPassword, setCambioPassword] = useState<Usuario | null>(null);
  const [borrando, setBorrando] = useState<Usuario | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [confirmacion, setConfirmacion] = useState("");

  const { data } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => apiFetch<{ usuarios: Usuario[] }>("/api/usuarios"),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["usuarios"] });

  // Al abrir el formulario de edición se precargan los datos del usuario
  useEffect(() => {
    if (editando) {
      setCampos({
        nombre: editando.nombre,
        nbi: editando.nbi,
        email: editando.email,
        rol: editando.rol,
      });
    }
  }, [editando]);

  useEffect(() => {
    setConfirmacion("");
  }, [borrando?.id]);

  const crear = useMutation({
    mutationFn: () =>
      apiFetch("/api/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nombre: campos.nombre,
          nbi: campos.nbi,
          email: campos.email,
          password: campos.password,
          rol: campos.rol ?? "OPERARIO",
        }),
      }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setCreando(false);
      setCampos({});
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, cuerpo }: { id: string; cuerpo: Record<string, unknown> }) =>
      apiFetch(`/api/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(cuerpo) }),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      setEditando(null);
      setCambioPassword(null);
      setCampos({});
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => apiFetch<{ accion: string; recuentos: number }>(`/api/usuarios/${id}`, {
      method: "DELETE",
    }),
    onSuccess: (r) => {
      if (r.accion === "desactivado") {
        toast.success("Usuario desactivado", {
          description: `Tiene ${r.recuentos} recuentos firmados: se conserva para no perder la trazabilidad, pero ya no puede entrar.`,
        });
      } else {
        toast.success("Usuario eliminado");
      }
      setBorrando(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <Button onPress={() => (setCampos({}), setCreando(true))}>
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Usuarios">
            <Table.Header>
              <Table.Column isRowHeader>Nombre</Table.Column>
              <Table.Column>NBI</Table.Column>
              <Table.Column>Email</Table.Column>
              <Table.Column>Rol</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column aria-label="Acciones"> </Table.Column>
            </Table.Header>
            <Table.Body>
              {(data?.usuarios ?? []).map((u) => (
                <Table.Row key={u.id}>
                  <Table.Cell className="font-medium">{u.nombre}</Table.Cell>
                  <Table.Cell className="font-mono">{u.nbi}</Table.Cell>
                  <Table.Cell className="text-muted">{u.email}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant={u.rol === "ADMIN" ? "primary" : "soft"}>
                      {ETIQUETAS_ROL[u.rol]}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    {u.activo ? (
                      <Chip size="sm" color="success" variant="soft">
                        Activo
                      </Chip>
                    ) : (
                      <Chip size="sm" color="danger" variant="soft">
                        Desactivado
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label={`Editar ${u.nombre}`}
                        onPress={() => setEditando(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label={`Cambiar contraseña de ${u.nombre}`}
                        onPress={() => (setCampos({}), setCambioPassword(u))}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label={u.activo ? `Desactivar ${u.nombre}` : `Reactivar ${u.nombre}`}
                        onPress={() => actualizar.mutate({ id: u.id, cuerpo: { activo: !u.activo } })}
                      >
                        {u.activo ? (
                          <UserX className="h-4 w-4 text-danger" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-success" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        className="text-muted"
                        aria-label={`Eliminar ${u.nombre}`}
                        onPress={() => setBorrando(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Alta de usuario */}
      <Modal isOpen={creando} onOpenChange={(o) => !o && setCreando(false)}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Nuevo usuario</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  El NBI identifica al trabajador y se usa en la firma de los recuentos.
                </p>
                {(
                  [
                    ["nombre", "Nombre completo", "text"],
                    ["nbi", "NBI", "text"],
                    ["email", "Email", "email"],
                    ["password", "Contraseña (mín. 8 caracteres)", "password"],
                  ] as const
                ).map(([clave, etiqueta, tipo]) => (
                  <TextField
                    key={clave}
                    fullWidth
                    type={tipo}
                    value={campos[clave] ?? ""}
                    onChange={(v) => setCampos({ ...campos, [clave]: v })}
                  >
                    <Label>{etiqueta}</Label>
                    <Input />
                  </TextField>
                ))}
                <CampoSelect
                  label="Rol"
                  valor={campos.rol ?? "OPERARIO"}
                  onCambio={(v) => setCampos({ ...campos, rol: v })}
                  opciones={OPCIONES_ROL}
                />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setCreando(false)}>
                  Cancelar
                </Button>
                <Button onPress={() => crear.mutate()} isDisabled={crear.isPending}>
                  Crear usuario
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Edición completa */}
      <Modal isOpen={editando !== null} onOpenChange={(o) => !o && setEditando(null)}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Editar usuario</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {(
                  [
                    ["nombre", "Nombre completo", "text"],
                    ["nbi", "NBI", "text"],
                    ["email", "Email", "email"],
                  ] as const
                ).map(([clave, etiqueta, tipo]) => (
                  <TextField
                    key={clave}
                    fullWidth
                    type={tipo}
                    value={campos[clave] ?? ""}
                    onChange={(v) => setCampos({ ...campos, [clave]: v })}
                  >
                    <Label>{etiqueta}</Label>
                    <Input />
                  </TextField>
                ))}
                <CampoSelect
                  label="Rol"
                  valor={campos.rol ?? "OPERARIO"}
                  onCambio={(v) => setCampos({ ...campos, rol: v })}
                  opciones={OPCIONES_ROL}
                />
                <p className="text-xs text-muted">
                  La contraseña se cambia desde el botón de la llave.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={actualizar.isPending || !campos.nombre?.trim()}
                  onPress={() =>
                    editando &&
                    actualizar.mutate({
                      id: editando.id,
                      cuerpo: {
                        nombre: campos.nombre,
                        nbi: campos.nbi,
                        email: campos.email,
                        rol: campos.rol,
                      },
                    })
                  }
                >
                  Guardar cambios
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Cambio de contraseña */}
      <Modal isOpen={cambioPassword !== null} onOpenChange={(o) => !o && setCambioPassword(null)}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Cambiar contraseña de {cambioPassword?.nombre}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextField
                  fullWidth
                  type="password"
                  value={campos.nuevaPassword ?? ""}
                  onChange={(v) => setCampos({ ...campos, nuevaPassword: v })}
                >
                  <Label>Nueva contraseña (mín. 8 caracteres)</Label>
                  <Input />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setCambioPassword(null)}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={(campos.nuevaPassword ?? "").length < 8 || actualizar.isPending}
                  onPress={() =>
                    cambioPassword &&
                    actualizar.mutate({
                      id: cambioPassword.id,
                      cuerpo: { password: campos.nuevaPassword },
                    })
                  }
                >
                  Guardar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Eliminar usuario (doble confirmación) */}
      <Modal isOpen={borrando !== null} onOpenChange={(o) => !o && setBorrando(null)}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-danger" />
                  Eliminar usuario
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm font-semibold">{borrando?.nombre}</p>
                <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
                  Si este usuario ya ha firmado recuentos, <b>no se borrará</b>: se desactivará
                  para no perder la trazabilidad (su nombre y NBI deben seguir figurando en los
                  recuentos que firmó). Si no tiene ningún dato asociado, se eliminará
                  definitivamente.
                </div>
                <TextField fullWidth value={confirmacion} onChange={setConfirmacion}>
                  <Label>Para confirmar, escribe «{borrando?.nbi}»</Label>
                  <Input autoComplete="off" placeholder={borrando?.nbi} />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setBorrando(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  isDisabled={confirmacion.trim() !== borrando?.nbi || eliminar.isPending}
                  onPress={() => borrando && eliminar.mutate(borrando.id)}
                >
                  Eliminar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

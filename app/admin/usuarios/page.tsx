"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, UserX, UserCheck } from "lucide-react";
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

/** Gestión de usuarios (solo administrador). El NBI es obligatorio: firma los recuentos. */
export default function PaginaUsuarios() {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [cambioPassword, setCambioPassword] = useState<Usuario | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => apiFetch<{ usuarios: Usuario[] }>("/api/usuarios"),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["usuarios"] });

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
      setCambioPassword(null);
      setCampos({});
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <Button onPress={() => setCreando(true)}>
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
                        aria-label="Cambiar contraseña"
                        onPress={() => setCambioPassword(u)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        aria-label={u.activo ? "Desactivar" : "Reactivar"}
                        onPress={() => actualizar.mutate({ id: u.id, cuerpo: { activo: !u.activo } })}
                      >
                        {u.activo ? (
                          <UserX className="h-4 w-4 text-danger" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-success" />
                        )}
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
                  opciones={[
                    { valor: "OPERARIO", etiqueta: "Operario" },
                    { valor: "OFICINISTA", etiqueta: "Oficinista" },
                    { valor: "ADMIN", etiqueta: "Administrador" },
                  ]}
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
                  <Label>Nueva contraseña</Label>
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
    </div>
  );
}

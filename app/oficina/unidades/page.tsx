"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Chip, Input, Label, Table, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/cliente-api";

interface Unidad {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

/** Catálogo editable de unidades de medida (UD, M, KG, CAJA, PALLET…). */
export default function PaginaUnidades() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");

  const { data } = useQuery({
    queryKey: ["unidades"],
    queryFn: () => apiFetch<{ unidades: Unidad[] }>("/api/unidades"),
  });

  const crear = useMutation({
    mutationFn: () =>
      apiFetch("/api/unidades", { method: "POST", body: JSON.stringify({ codigo, nombre }) }),
    onSuccess: () => {
      toast.success("Unidad añadida");
      setCodigo("");
      setNombre("");
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/unidades/${id}`, { method: "DELETE" }),
    onSuccess: (r: unknown) => {
      const res = r as { desactivada?: boolean };
      toast.success(
        res.desactivada
          ? "La unidad está en uso: se ha desactivado en lugar de eliminarla"
          : "Unidad eliminada"
      );
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Unidades de medida</h1>

      <Card>
        <Card.Header>
          <Card.Title>Añadir unidad</Card.Title>
          <Card.Description>
            El operario las elige al contar: unidades, metros, kilogramos, cajas…
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-wrap items-end gap-3">
          <TextField className="w-28" value={codigo} onChange={(v) => setCodigo(v.toUpperCase())}>
            <Label>Código</Label>
            <Input placeholder="L" />
          </TextField>
          <TextField className="min-w-40 flex-1" value={nombre} onChange={setNombre}>
            <Label>Nombre</Label>
            <Input placeholder="Litros" />
          </TextField>
          <Button
            onPress={() => crear.mutate()}
            isDisabled={!codigo.trim() || !nombre.trim() || crear.isPending}
          >
            <Plus className="h-4 w-4" />
            Añadir
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Unidades de medida">
                <Table.Header>
                  <Table.Column isRowHeader>Código</Table.Column>
                  <Table.Column>Nombre</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column aria-label="Acciones"> </Table.Column>
                </Table.Header>
                <Table.Body>
                  {(data?.unidades ?? []).map((u) => (
                    <Table.Row key={u.id}>
                      <Table.Cell className="font-mono font-semibold">{u.codigo}</Table.Cell>
                      <Table.Cell>{u.nombre}</Table.Cell>
                      <Table.Cell>
                        {u.activa ? (
                          <Chip size="sm" color="success" variant="soft">
                            Activa
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft">
                            Desactivada
                          </Chip>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          className="text-muted"
                          onPress={() => borrar.mutate(u.id)}
                          aria-label={`Eliminar ${u.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}

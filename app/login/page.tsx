"use client";

import { useActionState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { iniciarSesion } from "./actions";

export default function PaginaLogin() {
  const [error, accion, pendiente] = useActionState(iniciarSesion, undefined);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background-secondary p-4">
      <Card className="w-full max-w-sm">
        <Card.Header className="flex flex-col items-center text-center">
          <div className="mb-2 rounded-xl bg-accent-soft p-3">
            <ClipboardList className="h-8 w-8 text-accent" />
          </div>
          <Card.Title className="text-xl">Inventario</Card.Title>
          <Card.Description>Recuentos físicos de almacén</Card.Description>
        </Card.Header>
        <Card.Content>
          <form action={accion} className="grid gap-4">
            <TextField name="email" type="email" isRequired fullWidth>
              <Label>Email</Label>
              <Input autoComplete="email" placeholder="tu@empresa.es" />
            </TextField>
            <TextField name="password" type="password" isRequired fullWidth>
              <Label>Contraseña</Label>
              <Input autoComplete="current-password" />
            </TextField>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" isDisabled={pendiente} fullWidth>
              {pendiente && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </Card.Content>
      </Card>
    </main>
  );
}

"use client";

import { Label, ListBox, Select } from "@heroui/react";

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

/**
 * Selector simple sobre el Select compuesto de HeroUI, para los casos
 * habituales de la app (unidades, ámbitos, roles…).
 */
export function CampoSelect({
  label,
  ariaLabel,
  placeholder,
  valor,
  onCambio,
  opciones,
  className,
  isDisabled,
}: {
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  valor: string | null;
  onCambio: (valor: string) => void;
  opciones: OpcionSelect[];
  className?: string;
  isDisabled?: boolean;
}) {
  return (
    <Select
      fullWidth
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel ?? label ?? placeholder}
      selectedKey={valor}
      onSelectionChange={(clave) => {
        if (clave != null) onCambio(String(clave));
      }}
      isDisabled={isDisabled}
    >
      {label && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {opciones.map((o) => (
            <ListBox.Item key={o.valor} id={o.valor} textValue={o.etiqueta}>
              <Label>{o.etiqueta}</Label>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, ChevronRight, Lock, MapPin, PlayCircle, RefreshCw, Search } from "lucide-react";
import { Button, Card, Chip, Input } from "@heroui/react";
import { toast } from "@/lib/toast";
import { dbLocal, type UbicacionLocal } from "@/lib/offline/db-local";
import { iniciarRecuento, precargarEstructura } from "@/lib/offline/operaciones";
import { formatearFecha } from "@/lib/utils";

/**
 * Pantalla inicial del operario: elegir la ubicación donde va a contar,
 * por búsqueda de código o navegando pasillo → estantería → ubicación.
 * Todo funciona contra IndexedDB, también sin conexión.
 */
export default function PaginaOperario() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pasilloSel, setPasilloSel] = useState<string | null>(null);
  const [estanteriaSel, setEstanteriaSel] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const ubicaciones = useLiveQuery(() => dbLocal.ubicaciones.toArray(), []) ?? [];
  const recuentosEnCurso =
    useLiveQuery(
      () => dbLocal.recuentos.where("estado").equals("EN_PROGRESO").reverse().sortBy("iniciadoEn"),
      []
    ) ?? [];
  const recuentosFinalizados =
    useLiveQuery(
      () => dbLocal.recuentos.where("estado").equals("FINALIZADO").reverse().sortBy("finalizadoEn"),
      []
    ) ?? [];

  const pasillos = useMemo(() => {
    const mapa = new Map<string, { id: string; codigo: string; nombre: string }>();
    for (const u of ubicaciones) {
      if (!mapa.has(u.pasilloId)) {
        mapa.set(u.pasilloId, { id: u.pasilloId, codigo: u.pasilloCodigo, nombre: u.pasilloNombre });
      }
    }
    return [...mapa.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [ubicaciones]);

  const estanterias = useMemo(() => {
    if (!pasilloSel) return [];
    const mapa = new Map<string, { id: string; codigo: string }>();
    for (const u of ubicaciones) {
      if (u.pasilloId === pasilloSel && !mapa.has(u.estanteriaId)) {
        mapa.set(u.estanteriaId, { id: u.estanteriaId, codigo: u.estanteriaCodigo });
      }
    }
    return [...mapa.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [ubicaciones, pasilloSel]);

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (texto) {
      return ubicaciones.filter((u) => u.codigo.toLowerCase().includes(texto)).slice(0, 30);
    }
    if (estanteriaSel) {
      return ubicaciones.filter((u) => u.estanteriaId === estanteriaSel);
    }
    return [];
  }, [ubicaciones, busqueda, estanteriaSel]);

  async function empezar(ubicacion: UbicacionLocal) {
    if (iniciando) return;
    // Si ya hay un recuento local para esta ubicación (en curso o finalizado),
    // se abre ese en vez de crear uno nuevo (evita contar dos veces).
    const enCurso = recuentosEnCurso.find((r) => r.ubicacionId === ubicacion.id);
    if (enCurso) {
      router.push(`/operario/recuento/${enCurso.id}`);
      return;
    }
    const finalizado = recuentosFinalizados.find((r) => r.ubicacionId === ubicacion.id);
    if (finalizado) {
      router.push(`/operario/recuento/${finalizado.id}`);
      return;
    }
    if (ubicacion.ocupada) {
      toast.warning("Otro operario está contando en esa ubicación");
      return;
    }
    setIniciando(true);
    try {
      const recuento = await iniciarRecuento(ubicacion);
      router.push(`/operario/recuento/${recuento.id}`);
    } finally {
      setIniciando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Recuentos en curso del operario */}
      {recuentosEnCurso.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Continuar recuento</h2>
          {recuentosEnCurso.map((r) => (
            <Card
              key={r.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors active:bg-surface-hover"
              onClick={() => router.push(`/operario/recuento/${r.id}`)}
            >
              <Card.Content className="flex flex-row items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-semibold">{r.ubicacionCodigo}</p>
                  <p className="line-clamp-1 text-sm text-muted">{r.ruta}</p>
                  <p className="text-xs text-muted">Iniciado {formatearFecha(r.iniciadoEn)}</p>
                  {r.conflicto && (
                    <Chip color="danger" variant="soft" size="sm" className="mt-1">
                      Ubicación ocupada por otro operario
                    </Chip>
                  )}
                </div>
                <PlayCircle className="h-7 w-7 shrink-0 text-accent" />
              </Card.Content>
            </Card>
          ))}
        </section>
      )}

      {/* Búsqueda por código */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">¿Dónde vas a contar?</h2>
          {/* Actualizar manualmente si la oficina acaba de crear estructura */}
          <Button
            variant="ghost"
            size="sm"
            isDisabled={actualizando}
            onPress={async () => {
              setActualizando(true);
              try {
                const ok = await precargarEstructura();
                toast[ok ? "success" : "warning"](
                  ok ? "Estructura actualizada" : "Sin conexión: se actualizará al recuperarla"
                );
              } finally {
                setActualizando(false);
              }
            }}
          >
            <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input
            fullWidth
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código de ubicación…"
            className="pl-10 text-base"
            inputMode="search"
            autoCapitalize="characters"
            aria-label="Buscar código de ubicación"
          />
        </div>
      </section>

      {/* Navegación jerárquica (si no hay búsqueda activa) */}
      {!busqueda.trim() && (
        <section className="flex flex-col gap-2">
          {ubicaciones.length === 0 && (
            <Card>
              <Card.Content className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm text-muted">
                  No hay estructura de almacén descargada en este dispositivo. Conéctate una
                  vez para precargarla y podrás trabajar sin cobertura.
                </p>
                <Button
                  variant="outline"
                  onPress={async () => {
                    const ok = await precargarEstructura();
                    if (ok) toast.success("Estructura descargada");
                    else toast.warning("Sin conexión: inténtalo cuando tengas cobertura");
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Descargar estructura
                </Button>
              </Card.Content>
            </Card>
          )}

          {!pasilloSel &&
            pasillos.map((e) => (
              <Card
                key={e.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-colors active:bg-surface-hover"
                onClick={() => setPasilloSel(e.id)}
              >
                <Card.Content className="flex flex-row items-center justify-between">
                  <div>
                    <p className="font-semibold">{e.codigo}</p>
                    <p className="text-sm text-muted">{e.nombre}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted" />
                </Card.Content>
              </Card>
            ))}

          {pasilloSel && !estanteriaSel && (
            <>
              <Button variant="ghost" size="sm" className="self-start" onPress={() => setPasilloSel(null)}>
                ← Pasillos
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {estanterias.map((e) => (
                  <Card
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer transition-colors active:bg-surface-hover"
                    onClick={() => setEstanteriaSel(e.id)}
                  >
                    <Card.Content className="flex items-center justify-center p-5">
                      <p className="text-lg font-semibold">{e.codigo}</p>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            </>
          )}

          {estanteriaSel && (
            <Button variant="ghost" size="sm" className="self-start" onPress={() => setEstanteriaSel(null)}>
              ← Estanterías
            </Button>
          )}
        </section>
      )}

      {/* Resultados (búsqueda o estantería elegida) */}
      {resultados.length > 0 && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resultados.map((u) => (
            <button
              key={u.id}
              onClick={() => empezar(u)}
              disabled={iniciando}
              className="flex flex-col items-start gap-1 rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors active:bg-surface-hover disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="font-semibold leading-tight">{u.codigo}</span>
                {u.ocupada ? (
                  <Lock className="h-4 w-4 shrink-0 text-warning" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0 text-muted" />
                )}
              </span>
              <span className="text-xs text-muted">
                {u.pasilloCodigo} · {u.estanteriaCodigo}
              </span>
              {u.ocupada && <span className="text-xs font-medium text-warning">Ocupada</span>}
            </button>
          ))}
        </section>
      )}

      {busqueda.trim() && resultados.length === 0 && ubicaciones.length > 0 && (
        <p className="py-6 text-center text-sm text-muted">
          Ninguna ubicación coincide con «{busqueda}»
        </p>
      )}

      {/* Ubicaciones que ya has contado: verlas o reabrirlas para recontar */}
      {!busqueda.trim() && !pasilloSel && recuentosFinalizados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Ubicaciones contadas</h2>
          {recuentosFinalizados.map((r) => (
            <Card
              key={r.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-colors active:bg-surface-hover"
              onClick={() => router.push(`/operario/recuento/${r.id}`)}
            >
              <Card.Content className="flex flex-row items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-semibold">{r.ubicacionCodigo}</p>
                  <p className="line-clamp-1 text-sm text-muted">{r.ruta}</p>
                  <p className="text-xs text-muted">Contada {formatearFecha(r.finalizadoEn)}</p>
                </div>
                <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
              </Card.Content>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

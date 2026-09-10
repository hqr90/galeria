import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useArtStore } from '../store/useArtStore';
import type { ArtAsset, MonitorInfo } from '../types/art';

interface FolderSelectorModalProps {
  onClose: () => void;
  closable: boolean;
}

const DEVICE_PREFIX = '\\\\.\\';

/** `\\.\DISPLAY5` não diz nada; a diagonal em polegadas, sim. */
function describeMonitor(monitor: MonitorInfo): string {
  const short = monitor.name.startsWith(DEVICE_PREFIX)
    ? monitor.name.slice(DEVICE_PREFIX.length)
    : monitor.name;
  if (!monitor.physicalWidthMm || !monitor.physicalHeightMm) return short;
  const diagonal = Math.hypot(monitor.physicalWidthMm, monitor.physicalHeightMm) / 25.4;
  return `${short} · ${diagonal.toFixed(0)}"`;
}

const DURATION_PRESETS = [
  { label: '12s', value: 12000 },
  { label: '26s', value: 26000 },
  { label: '45s', value: 45000 },
  { label: '90s', value: 90000 },
];

export const FolderSelectorModal: React.FC<FolderSelectorModalProps> = ({ onClose, closable }) => {
  const selectedDirectory = useArtStore((s) => s.selectedDirectory);
  const slideDuration = useArtStore((s) => s.slideDuration);
  const targetMonitorIndex = useArtStore((s) => s.targetMonitorIndex);
  const startFullscreen = useArtStore((s) => s.startFullscreen);
  const setDirectory = useArtStore((s) => s.setDirectory);
  const setPlaylist = useArtStore((s) => s.setPlaylist);
  const setSlideDuration = useArtStore((s) => s.setSlideDuration);
  const setTargetMonitor = useArtStore((s) => s.setTargetMonitor);
  const setStartFullscreen = useArtStore((s) => s.setStartFullscreen);

  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<MonitorInfo[]>('get_system_monitors')
      .then(setMonitors)
      .catch(() => setMonitors([]));
  }, []);

  const pickFolder = useCallback(async () => {
    const chosen = await open({ directory: true, multiple: false, title: 'Escolha a pasta de obras' });
    if (typeof chosen === 'string') {
      setDirectory(chosen);
      setError(null);
    }
  }, [setDirectory]);

  const start = useCallback(async () => {
    if (!selectedDirectory) return;
    setLoading(true);
    setError(null);
    try {
      const assets = await invoke<ArtAsset[]>('scan_art_directory', {
        folderPath: selectedDirectory,
      });
      setPlaylist(assets);

      if (targetMonitorIndex !== null) {
        await invoke('move_to_monitor', {
          monitorIndex: targetMonitorIndex,
          fullscreen: startFullscreen,
        });
      } else if (startFullscreen) {
        await invoke('toggle_fullscreen', { force: true });
      }
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Falha ao ler a pasta selecionada.');
    } finally {
      setLoading(false);
    }
  }, [selectedDirectory, targetMonitorIndex, startFullscreen, setPlaylist, onClose]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-8">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-950/90 p-8 shadow-2xl">
        <header className="mb-8">
          <h2 className="text-2xl font-light tracking-wide text-white">FrameCast</h2>
          <p className="mt-1 text-sm text-white/40">
            Transforme um monitor em uma galeria de arte contínua.
          </p>
        </header>

        <section className="mb-7">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
            Pasta de obras
          </label>
          <div className="flex items-center gap-3">
            <span className="flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/70">
              {selectedDirectory ?? 'Nenhuma pasta selecionada'}
            </span>
            <button
              type="button"
              onClick={() => void pickFolder()}
              className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Procurar
            </button>
          </div>
        </section>

        <section className="mb-7">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
            Duração por obra
          </label>
          <div className="flex gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setSlideDuration(preset.value)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  slideDuration === preset.value
                    ? 'border-white/60 bg-white/10 text-white'
                    : 'border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">
            Monitor de exibição
          </label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setTargetMonitor(null)}
              className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition-colors ${
                targetMonitorIndex === null
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-white/10 text-white/50 hover:bg-white/5'
              }`}
            >
              Manter nesta janela
            </button>
            {monitors.map((monitor) => (
              <button
                key={monitor.index}
                type="button"
                onClick={() => setTargetMonitor(monitor.index)}
                className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition-colors ${
                  targetMonitorIndex === monitor.index
                    ? 'border-white/60 bg-white/10 text-white'
                    : 'border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                <span className="block truncate">{describeMonitor(monitor)}</span>
                <span className="text-xs text-white/35">
                  {monitor.width}×{monitor.height}
                  {monitor.isPortrait ? ' · retrato' : ''}
                  {monitor.dpiX ? ` · ${monitor.dpiX.toFixed(0)} dpi` : ''}
                  {monitor.isPrimary ? ' · principal' : ''}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <button
            type="button"
            role="switch"
            aria-checked={startFullscreen}
            onClick={() => setStartFullscreen(!startFullscreen)}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5"
          >
            <span>
              <span className="block text-sm text-white/80">Tela cheia</span>
              <span className="block text-xs text-white/35">
                Some com a barra de título e o cursor; `F` alterna a qualquer momento
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                startFullscreen ? 'bg-white/80' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
                  startFullscreen ? 'left-6 bg-black' : 'left-1 bg-white/70'
                }`}
              />
            </span>
          </button>
        </section>

        {error && <p className="mb-4 text-sm text-red-400/80">{error}</p>}

        <footer className="flex items-center justify-between gap-4">
          <p className="text-xs leading-relaxed text-white/30">
            F tela cheia · Espaço pausa · ← → navega · I legenda · Z inspeção · Q
            diagnóstico · O esta janela
          </p>
          <div className="flex gap-2">
            {closable && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-3 text-sm text-white/50 transition-colors hover:text-white/80"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={!selectedDirectory || isLoading}
              onClick={() => void start()}
              className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isLoading ? 'Lendo…' : 'Exibir'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

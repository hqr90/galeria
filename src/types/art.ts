export interface ArtAsset {
  path: string;
  filename: string;
  extension: string;
}

export interface ArtItem extends ArtAsset {
  /** URL servida pelo protocolo asset:// do Tauri. */
  assetUrl: string;
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scaleFactor: number;
  isPrimary: boolean;
  isPortrait: boolean;
  physicalWidthMm: number | null;
  physicalHeightMm: number | null;
  dpiX: number | null;
  dpiY: number | null;
}

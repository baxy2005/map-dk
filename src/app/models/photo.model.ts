export interface PhotoLocation {
  id: string;
  file?: File;           // not persisted — unavailable after refresh
  fileDataUrl: string;   // base64 — used for display, survives refresh
  storagePath?: string;
  lat: number;
  lng: number;
  timestamp?: Date;
  fileName: string;
  locationName?: string;
  address?: PhotoAddress;
  exifData?: ExifData;
}

export interface PhotoAddress {
  village?: string;
  town?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export interface ExifData {
  dateTime?: string;
  make?: string;
  model?: string;
  software?: string;
  orientation?: number;
  xResolution?: number;
  yResolution?: number;
  flashUsed?: boolean;
  focalLength?: number;
  iso?: number;
}

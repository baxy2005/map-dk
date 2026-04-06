import { Injectable, signal } from '@angular/core';
import * as L from 'leaflet';

const CUSTOM_PIN_SVG_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/20/Logo_of_the_Democratic_Coalition_%28Hungary%29.svg';
const CUSTOM_PIN_PNG_FALLBACK_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Logo_of_the_Democratic_Coalition_%28Hungary%29.svg/500px-Logo_of_the_Democratic_Coalition_%28Hungary%29.svg.png';

// SVG camera-pin marker — no external image files needed
function createCameraIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px; height:42px; position:relative;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 42" width="36" height="42">
          <!-- Pin body -->
          <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 24 18 24S36 31.5 36 18C36 8.06 27.94 0 18 0z"
            fill="#4285f4" stroke="#2a6cdb" stroke-width="1"/>
          <!-- White circle background for camera -->
          <circle cx="18" cy="17" r="10" fill="white"/>
          <!-- Camera icon -->
          <path d="M13 13.5h1.5l1.2-1.5h4.6l1.2 1.5H23a1 1 0 011 1V22a1 1 0 01-1 1H13a1 1 0 01-1-1v-7.5a1 1 0 011-1z"
            fill="none" stroke="#4285f4" stroke-width="1.2" stroke-linejoin="round"/>
          <circle cx="18" cy="17.5" r="2.5" fill="#4285f4"/>
        </svg>
      </div>`,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -44]
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createPhotoPinIcon(imageUrl?: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:44px;
        height:56px;
        position:relative;
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));
      ">
        <img
          src="${escapeHtml(CUSTOM_PIN_SVG_URL)}"
          onerror="this.onerror=null;this.src='${escapeHtml(CUSTOM_PIN_PNG_FALLBACK_URL)}';"
          alt="Pin"
          style="
            position:absolute;
            left:0;
            top:0;
            width:44px;
            height:56px;
            object-fit:contain;
            z-index:1;
            pointer-events:none;
          "
        />
      </div>
    `,
    iconSize: [44, 56],
    iconAnchor: [22, 56],
    popupAnchor: [0, -44],
  });
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: L.Map | null = null;
  private markers: Map<string, L.Marker> = new Map();
  public selectedPhotoId = signal<string | null>(null);

  constructor() {}

  initMap(containerElement: HTMLElement): L.Map {
    if (this.map) {
      return this.map;
    }

    this.map = L.map(containerElement).setView([47.5, 19.5], 7);

    // Clean basemap with very subtle natural/water coloring.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      minZoom: 1,
      subdomains: 'abcd',
      className: 'map-base-layer',
    }).addTo(this.map);

    // Add stronger road/place labels back so street and city names remain readable.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      minZoom: 1,
      subdomains: 'abcd',
      opacity: 1,
      pane: 'overlayPane',
      className: 'map-labels-layer',
    }).addTo(this.map);

    return this.map;
  }

  addMarker(
    id: string,
    position: { lat: number; lng: number },
    title: string,
    onClickCallback?: (photoId: string) => void
  ): L.Marker {
    if (!this.map) {
      throw new Error('Map not initialized');
    }

    const marker = L.marker([position.lat, position.lng], {
      icon: createPhotoPinIcon(),
      title: title
    }).addTo(this.map);

    marker.on('click', () => {
      this.selectedPhotoId.set(id);
      if (onClickCallback) {
        onClickCallback(id);
      }
    });

    (marker as any).photoId = id;
    this.markers.set(id, marker);
    return marker;
  }

  removeMarker(id: string): void {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
    }
  }

  updateMarkerTitle(id: string, title: string): void {
    const marker = this.markers.get(id);
    if (!marker) {
      return;
    }

    marker.options.title = title;
    const element = marker.getElement();
    if (element) {
      element.title = title;
    }
  }

  fitAllMarkers(): void {
    if (!this.map || this.markers.size === 0) return;
    const group = new L.FeatureGroup(Array.from(this.markers.values()));
    this.map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 14 });
  }

  getMap(): L.Map | null { return this.map; }
  getMarkers(): Map<string, L.Marker> { return this.markers; }

  clearAllMarkers(): void {
    this.markers.forEach(m => { if (this.map) this.map.removeLayer(m); });
    this.markers.clear();
  }
}

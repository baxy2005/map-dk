import { Component, OnInit, ViewChild, ElementRef, output, effect, HostListener } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { MapService } from '../../services/map.service';
import { PhotoBackendService } from '../../services/photo-backend.service';
import { PhotoLocation } from '../../models/photo.model';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit {
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef;

  photoSelected = output<PhotoLocation>();
  selectedPhoto: PhotoLocation | null = null;
  isLightboxOpen = false;

  constructor(
    private mapService: MapService,
    private photoService: PhotoBackendService
  ) {
    effect(() => {
      const photoId = this.mapService.selectedPhotoId();
      if (photoId) {
        this.selectedPhoto = this.photoService.getPhotoById(photoId) || null;
        if (this.selectedPhoto) {
          this.photoSelected.emit(this.selectedPhoto);
        }
      }
    });
  }

  ngOnInit(): void {
    this.mapService.initMap(this.mapContainer.nativeElement);

    this.photoService.getPhotos().subscribe(photos => {
      this.updateMarkers(photos);
      // Keep selected photo in sync with latest data (e.g. after geocoding update)
      if (this.selectedPhoto) {
        const updated = photos.find(p => p.id === this.selectedPhoto!.id);
        if (updated) this.selectedPhoto = updated;
      }
    });
  }

  private updateMarkers(photos: PhotoLocation[]): void {
    const currentMarkerIds = new Set(this.mapService.getMarkers().keys());
    currentMarkerIds.forEach(markerId => {
      if (!photos.find(p => p.id === markerId)) {
        this.mapService.removeMarker(markerId);
      }
    });

    photos.forEach(photo => {
      if (!this.mapService.getMarkers().has(photo.id)) {
        this.mapService.addMarker(
          photo.id,
          { lat: photo.lat, lng: photo.lng },
          photo.locationName ?? photo.fileName,
          async () => {
            this.selectedPhoto = this.photoService.getPhotoById(photo.id) || photo;
            if (this.selectedPhoto) {
              this.photoSelected.emit(this.selectedPhoto);
            }

            const resolvedPhoto = await this.photoService.ensurePhotoLocationDetails(photo.id);
            if (resolvedPhoto) {
              this.selectedPhoto = resolvedPhoto;
              this.photoSelected.emit(resolvedPhoto);
            }
          }
        );
      } else {
        this.mapService.updateMarkerTitle(photo.id, photo.locationName ?? photo.fileName);
      }
    });

    if (photos.length > 0) {
      this.mapService.fitAllMarkers();
    }
  }

  async removePhoto(photoId: string): Promise<void> {
    await this.photoService.removePhoto(photoId);
    if (this.selectedPhoto?.id === photoId) {
      this.selectedPhoto = null;
      this.isLightboxOpen = false;
    }
  }

  openLightbox(): void {
    if (!this.selectedPhoto?.fileDataUrl) {
      return;
    }

    this.isLightboxOpen = true;
  }

  closeLightbox(): void {
    this.isLightboxOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.isLightboxOpen) {
      this.closeLightbox();
    }
  }
}

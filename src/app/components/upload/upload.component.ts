import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhotoBackendService } from '../../services/photo-backend.service';

interface UploadItem {
  fileName: string;
  status: 'processing' | 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent {
  isUploading = false;
  isDraggingOver = false;
  uploadItems: UploadItem[] = [];
  pinCount = 0;

  constructor(private photoService: PhotoBackendService) {
    this.photoService.getPhotos().subscribe((photos) => {
      this.pinCount = photos.length;
    });
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.processFiles(Array.from(input.files));
    input.value = '';
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) await this.processFiles(files);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver = false;
  }

  private async processFiles(files: File[]): Promise<void> {
    const imageFiles = files.filter((file) => this.isUploadableImageFile(file));
    if (!imageFiles.length) return;

    this.isUploading = true;
    this.uploadItems = imageFiles.map(f => ({
      fileName: f.name,
      status: 'processing' as const,
      message: 'Reading EXIF data...'
    }));

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      this.uploadItems[i] = { ...this.uploadItems[i], message: 'Extracting GPS...' };

      try {
        const metadata = await this.withTimeout(
          this.photoService.extractPhotoMetadata(file),
          15000,
          'Timed out while reading EXIF GPS data'
        );

        if (!metadata) {
          this.uploadItems[i] = {
            fileName: file.name,
            status: 'error',
            message: 'No GPS data found in this image.'
          };
          continue;
        }

        if (this.photoService.hasPhotoAtCoordinates(metadata.lat, metadata.lng)) {
          this.uploadItems[i] = {
            fileName: file.name,
            status: 'error',
            message: 'A photo with the same GPS coordinates already exists.'
          };
          continue;
        }

        this.uploadItems[i] = { ...this.uploadItems[i], message: 'Resolving location...' };

        const geoResult = await this.withTimeout(
          this.photoService.reverseGeocode(metadata.lat, metadata.lng),
          8000,
          'Timed out while resolving location name'
        ).catch(() => null);

        const locationName = geoResult?.locationName || file.name;
        const addressData = geoResult?.address || {};

        this.uploadItems[i] = {
          ...this.uploadItems[i],
          message: `Uploading to cloud storage as ${locationName}...`
        };

        const uploadFile = await this.photoService.prepareUploadFile(file);
        if (uploadFile !== file) {
          const action = this.isHeicFile(file) ? 'converted JPEG' : 'compressed image';
          this.uploadItems[i] = {
            ...this.uploadItems[i],
            message: `Uploading ${action} for ${locationName} (${Math.round(uploadFile.size / 1024)} KB)...`,
          };
        }

        const savedPhoto = await this.photoService.uploadPhoto(
          uploadFile,
          metadata.lat,
          metadata.lng,
          metadata.exifData,
          addressData,
          locationName,
          file.name
        );

        this.uploadItems[i] = {
          fileName: file.name,
          status: 'success',
          message: `Stored as ${savedPhoto.locationName || savedPhoto.fileName}`
        };

      } catch (err) {
        console.error(err);
        this.uploadItems[i] = {
          fileName: file.name,
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to process image.'
        };
      }
    }

    this.isUploading = false;
  }

  clearItems(): void {
    this.uploadItems = [];
  }

  private isUploadableImageFile(file: File): boolean {
    return file.type.startsWith('image/') || this.isHeicFile(file);
  }

  private isHeicFile(file: File): boolean {
    return /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type);
  }
}

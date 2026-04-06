import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as exifr from 'exifr';
import { PhotoLocation, PhotoAddress, ExifData } from '../models/photo.model';

type Heic2AnyConverter = (options: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

@Injectable({
  providedIn: 'root',
})
export class PhotoBackendService {
  private apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/photos';
  private backendOrigin = new URL(this.apiUrl).origin;
  private photosSubject = new BehaviorSubject<PhotoLocation[]>([]);
  private pendingLocationLookups = new Map<string, Promise<PhotoLocation>>();
  public photos$ = this.photosSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadPhotosFromBackend();
  }

  /**
   * Load photos from backend API
   */
  private loadPhotosFromBackend(): void {
    this.http
      .get<any>(`${this.apiUrl}`)
      .pipe(
        catchError((error) => {
          console.error('Failed to load photos from backend:', error);
          return of({ success: false, data: [] });
        })
      )
      .subscribe((response) => {
        if (response.success && Array.isArray(response.data)) {
          const photos = response.data.map((photo: any) => this.apiResponseToPhoto(photo));
          this.photosSubject.next(photos);
        }
      });
  }

  /**
   * Get all photos
   */
  getPhotos(): Observable<PhotoLocation[]> {
    return this.photos$;
  }

  getPhotoById(id: string): PhotoLocation | undefined {
    return this.photosSubject.value.find((photo) => photo.id === id);
  }

  async ensurePhotoLocationDetails(id: string): Promise<PhotoLocation | undefined> {
    const currentPhoto = this.getPhotoById(id);
    if (!currentPhoto) {
      return undefined;
    }

    if (!this.needsLocationLookup(currentPhoto)) {
      return currentPhoto;
    }

    const existingLookup = this.pendingLocationLookups.get(id);
    if (existingLookup) {
      return existingLookup;
    }

    const lookup = this.reverseGeocode(currentPhoto.lat, currentPhoto.lng)
      .then((geoResult) => {
        if (!geoResult) {
          return this.getPhotoById(id) || currentPhoto;
        }

        const latestPhoto = this.getPhotoById(id) || currentPhoto;
        const updatedPhoto: PhotoLocation = {
          ...latestPhoto,
          locationName: geoResult.locationName,
          address: {
            ...latestPhoto.address,
            ...geoResult.address,
          },
        };

        this.replacePhoto(updatedPhoto);
        return updatedPhoto;
      })
      .finally(() => {
        this.pendingLocationLookups.delete(id);
      });

    this.pendingLocationLookups.set(id, lookup);
    return lookup;
  }

  hasPhotoAtCoordinates(lat: number, lng: number): boolean {
    const tolerance = 0.000001;

    return this.photosSubject.value.some((photo) => {
      return Math.abs(photo.lat - lat) <= tolerance && Math.abs(photo.lng - lng) <= tolerance;
    });
  }

  /**
   * Upload a new photo to the backend
   */
  async uploadPhoto(
    file: File,
    lat: number,
    lng: number,
    exifData: ExifData = {},
    addressData: PhotoAddress = {},
    locationName?: string,
    title?: string
  ): Promise<PhotoLocation> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('location_name', locationName || file.name);
    formData.append('title', title || file.name);
    formData.append('latitude', lat.toString());
    formData.append('longitude', lng.toString());

    if (exifData.dateTime) {
      formData.append('date_taken', exifData.dateTime);
    }

    // Add EXIF data
    const exifPayload: any = {};
    if (exifData.make) exifPayload.exif_camera_make = exifData.make;
    if (exifData.model) exifPayload.exif_camera_model = exifData.model;
    if (exifData.iso) exifPayload.exif_iso = exifData.iso;
    if (exifData.focalLength) exifPayload.exif_focal_length = exifData.focalLength;
    if (exifData.flashUsed !== undefined) exifPayload.exif_flash = exifData.flashUsed;

    formData.append('exif_data', JSON.stringify(exifPayload));

    // Add address data
    const addressPayload: any = {};
    if (addressData.village) addressPayload.address_village = addressData.village;
    if (addressData.town) addressPayload.address_town = addressData.town;
    if (addressData.city) addressPayload.address_city = addressData.city;
    if (addressData.county) addressPayload.address_county = addressData.county;
    if (addressData.state) addressPayload.address_state = addressData.state;
    if (addressData.country) addressPayload.address_country = addressData.country;
    if (addressData.postcode) addressPayload.address_postcode = addressData.postcode;

    formData.append('address_data', JSON.stringify(addressPayload));

    return new Promise((resolve, reject) => {
      this.http
        .post<any>(`${this.apiUrl}`, formData)
        .pipe(
          catchError((error) => {
            console.error('Upload failed:', error);
            reject(new Error(this.extractBackendError(error)));
            return of(null);
          })
        )
        .subscribe((response) => {
          if (response?.success && response?.data) {
            const photo = this.apiResponseToPhoto(response.data);
            const currentPhotos = this.photosSubject.value;
            this.photosSubject.next([...currentPhotos, photo]);
            resolve(photo);
          } else {
            reject(new Error('Upload failed'));
          }
        });
    });
  }

  async prepareUploadFile(file: File): Promise<File> {
    let workingFile = file;

    if (this.isHeicFile(workingFile)) {
      workingFile = await this.convertHeicToJpeg(workingFile);
    }

    const maxBytes = 1900 * 1024;
    if (workingFile.size <= maxBytes) {
      return workingFile;
    }

    try {
      const img = await this.loadImage(workingFile);
      const maxDimension = 2560;
      const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return file;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const jpegBlob = await this.canvasToBlob(canvas, 'image/jpeg', 0.82);
      if (!jpegBlob) {
        return workingFile;
      }

      const baseName = workingFile.name.replace(/\.[^.]+$/, '') || 'upload';
      const compressed = new File([jpegBlob], `${baseName}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      return compressed.size < workingFile.size ? compressed : workingFile;
    } catch {
      return workingFile;
    }
  }

  /**
   * Delete a photo from the backend
   */
  async removePhoto(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http
        .delete<any>(`${this.apiUrl}/${id}`)
        .pipe(
          catchError((error) => {
            console.error('Delete failed:', error);
            reject(new Error(this.extractBackendError(error)));
            return of(null);
          })
        )
        .subscribe((response) => {
          if (response?.success) {
            const currentPhotos = this.photosSubject.value.filter((p) => p.id !== id);
            this.photosSubject.next(currentPhotos);
            resolve();
          } else {
            reject(new Error('Delete failed'));
          }
        });
    });
  }

  /**
   * Extract EXIF metadata from image file
   */
  async extractPhotoMetadata(file: File): Promise<{ lat: number; lng: number; exifData?: ExifData } | null> {
    try {
      const exifData = await this.parseExifWithTimeout(file, 12000);

      if (exifData?.latitude == null || exifData?.longitude == null) {
        return null;
      }

      const metadata: ExifData = {
        make: exifData?.Make,
        model: exifData?.Model,
        dateTime: exifData?.DateTimeOriginal
          ? new Date(exifData.DateTimeOriginal).toISOString()
          : undefined,
        focalLength: typeof exifData?.FocalLength === 'number'
          ? exifData.FocalLength
          : undefined,
        iso: exifData?.ISO ?? exifData?.ISOSpeedRatings,
        flashUsed: exifData?.Flash != null ? !!(exifData.Flash & 1) : undefined,
      };

      return {
        lat: exifData.latitude,
        lng: exifData.longitude,
        exifData: metadata,
      };
    } catch (error) {
      console.warn('EXIF extraction failed:', error);
      return null;
    }
  }

  private async parseExifWithTimeout(file: File, timeoutMs: number): Promise<any> {
    const parsePromise = exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      pick: ['latitude', 'longitude', 'Make', 'Model', 'DateTimeOriginal', 'FocalLength', 'ISO', 'ISOSpeedRatings', 'Flash'],
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('EXIF extraction timed out')), timeoutMs);
    });

    return Promise.race([parsePromise, timeoutPromise]);
  }

  /**
   * Perform reverse geocoding via Nominatim API
   */
  async reverseGeocode(lat: number, lng: number): Promise<{ locationName: string; address: PhotoAddress } | null> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'PhotoMapApp/1.0',
          },
        }
      );
      const data = await response.json();

      if (data.address) {
        const address: PhotoAddress = {
          village: data.address.village,
          town: data.address.town,
          city: data.address.city,
          county: data.address.county,
          state: data.address.state,
          country: data.address.country,
          postcode: data.address.postcode,
        };

        const locationName =
          data.address.village ??
          data.address.hamlet ??
          data.address.town ??
          data.address.city ??
          data.address.municipality ??
          data.address.county ??
          data.display_name?.split(',')[0] ??
          'Unknown location';

        return { locationName, address };
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }

    return null;
  }

  /**
   * Convert API response to PhotoLocation object
   */
  private apiResponseToPhoto(apiData: any): PhotoLocation {
    const locationName = this.preferredLocationName(apiData);

    return {
      id: apiData.id,
      fileName: apiData.title || apiData.location_name || 'Photo',
      fileDataUrl: this.resolveImageUrl(apiData.image_url),
      lat: apiData.latitude,
      lng: apiData.longitude,
      timestamp: apiData.date_taken ? new Date(apiData.date_taken) : undefined,
      locationName,
      exifData: {
        dateTime: apiData.date_taken,
        make: apiData.exif_data?.make,
        model: apiData.exif_data?.model,
        iso: apiData.exif_data?.iso,
        focalLength: apiData.exif_data?.focal_length,
        flashUsed: apiData.exif_data?.flash,
      },
      address: apiData.address || {},
    };
  }

  private resolveImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return '';
    }

    if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    return `${this.backendOrigin}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
  }

  private extractBackendError(error: any): string {
    const data = error?.error;

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    if (data?.message && typeof data.message === 'string') {
      if (data?.errors && typeof data.errors === 'object') {
        const firstField = Object.keys(data.errors)[0];
        const firstMsg = firstField ? data.errors[firstField]?.[0] : null;
        if (firstMsg) {
          return firstMsg;
        }
      }
      return data.message;
    }

    return error?.message || 'Request failed';
  }

  private preferredLocationName(apiData: any): string | undefined {
    return apiData.location_name
      || apiData.address?.village
      || apiData.address?.town
      || apiData.address?.city
      || apiData.address?.county
      || apiData.address?.state
      || apiData.address?.country
      || undefined;
  }

  private needsLocationLookup(photo: PhotoLocation): boolean {
    const hasAddressLocation = !!(
      photo.address?.village
      || photo.address?.town
      || photo.address?.city
      || photo.address?.county
    );

    if (hasAddressLocation) {
      return false;
    }

    if (!photo.locationName) {
      return true;
    }

    const normalizedLocation = photo.locationName.trim().toLowerCase();
    const normalizedFileName = photo.fileName.trim().toLowerCase();

    return normalizedLocation === normalizedFileName || /\.[a-z0-9]{2,5}$/i.test(photo.locationName);
  }

  private replacePhoto(updatedPhoto: PhotoLocation): void {
    const nextPhotos = this.photosSubject.value.map((photo) => {
      return photo.id === updatedPhoto.id ? updatedPhoto : photo;
    });

    this.photosSubject.next(nextPhotos);
  }

  private isHeicFile(file: File): boolean {
    const fileType = file.type.toLowerCase();
    return fileType === 'image/heic'
      || fileType === 'image/heif'
      || fileType === 'image/heic-sequence'
      || fileType === 'image/heif-sequence'
      || /\.(heic|heif)$/i.test(file.name);
  }

  private async convertHeicToJpeg(file: File): Promise<File> {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default as Heic2AnyConverter;
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;

    if (!(jpegBlob instanceof Blob)) {
      throw new Error('HEIC conversion failed.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return new File([jpegBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };
      img.src = objectUrl;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PhotoLocation, PhotoAddress, ExifData } from '../models/photo.model';

const STORAGE_KEY = 'photo-map-photos';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private photosSubject = new BehaviorSubject<PhotoLocation[]>(this.loadFromStorage());
  public photos$ = this.photosSubject.asObservable();

  // ---- Persistence ----

  private loadFromStorage(): PhotoLocation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PhotoLocation[];
      // Restore Date objects
      return parsed.map(p => ({ ...p, timestamp: p.timestamp ? new Date(p.timestamp) : undefined }));
    } catch {
      return [];
    }
  }

  private saveToStorage(photos: PhotoLocation[]): void {
    try {
      // Never store the File object — only serialisable fields
      const serialisable = photos.map(({ file, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
    } catch (e) {
      console.warn('localStorage quota exceeded — photos not persisted', e);
    }
  }

  // ---- EXIF extraction ----

  async extractPhotoMetadata(file: File): Promise<{ lat: number; lng: number; exifData?: ExifData } | null> {
    try {
      const exifr = await import('exifr');
      const data = await exifr.parse(file, {
        gps: true,
        tiff: true,
        exif: true,
        pick: ['Make', 'Model', 'DateTimeOriginal', 'FocalLength', 'ISO', 'Flash', 'Software', 'latitude', 'longitude']
      });

      if (!data || data.latitude == null || data.longitude == null) {
        console.log('No GPS data found in image');
        return null;
      }

      const exifData: ExifData = {
        make: data.Make,
        model: data.Model,
        dateTime: data.DateTimeOriginal ? new Date(data.DateTimeOriginal).toLocaleString() : undefined,
        focalLength: data.FocalLength,
        iso: data.ISO,
        flashUsed: data.Flash != null ? !!(data.Flash & 1) : undefined
      };

      return { lat: data.latitude, lng: data.longitude, exifData };
    } catch (error) {
      console.error('Error extracting EXIF data:', error);
      return null;
    }
  }

  /** Convert a File to a base64 data URL so it can be stored in localStorage */
  fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- Reverse geocoding ----

  async reverseGeocode(lat: number, lng: number): Promise<{ locationName: string; address: PhotoAddress } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'PhotoMapApp/1.0' }
      });
      if (!response.ok) return null;

      const result = await response.json();
      const a = result.address ?? {};

      const address: PhotoAddress = {
        village: a.village ?? a.hamlet ?? a.suburb ?? undefined,
        town: a.town ?? a.city_district ?? undefined,
        city: a.city ?? a.municipality ?? undefined,
        county: a.county ?? undefined,
        state: a.state ?? undefined,
        country: a.country ?? undefined,
        postcode: a.postcode ?? undefined
      };

      const locationName =
        a.village ?? a.hamlet ?? a.town ?? a.city ?? a.municipality ?? a.county ?? a.state ??
        result.display_name?.split(',')[0] ?? 'Unknown location';

      return { locationName, address };
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return null;
    }
  }

  // ---- CRUD ----

  addPhoto(photoLocation: PhotoLocation): void {
    const next = [...this.photosSubject.value, photoLocation];
    this.photosSubject.next(next);
    this.saveToStorage(next);
  }

  removePhoto(id: string): void {
    const next = this.photosSubject.value.filter(p => p.id !== id);
    this.photosSubject.next(next);
    this.saveToStorage(next);
  }

  updatePhoto(id: string, updates: Partial<PhotoLocation>): void {
    const next = this.photosSubject.value.map(p => (p.id === id ? { ...p, ...updates } : p));
    this.photosSubject.next(next);
    this.saveToStorage(next);
  }

  getPhotos(): Observable<PhotoLocation[]> {
    return this.photos$;
  }

  getPhotoById(id: string): PhotoLocation | undefined {
    return this.photosSubject.value.find(p => p.id === id);
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as exifr from 'exifr';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { PhotoLocation, PhotoAddress, ExifData } from '../models/photo.model';

type Heic2AnyConverter = (options: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

type FirebasePhotoRecord = {
  fileName?: string;
  fileDataUrl?: string;
  lat?: number;
  lng?: number;
  uploadedAt?: string;
  locationName?: string;
  address?: PhotoAddress;
  exifData?: ExifData;
};

@Injectable({
  providedIn: 'root',
})
export class PhotoBackendService {
  private photosSubject = new BehaviorSubject<PhotoLocation[]>([]);
  private pendingLocationLookups = new Map<string, Promise<PhotoLocation | undefined>>();
  private firestore?: Firestore;
  private firebaseConfigured = false;
  public photos$ = this.photosSubject.asObservable();

  constructor() {
    this.initializeFirebase();
    if (this.firebaseConfigured) {
      this.loadPhotosFromFirebase();
    } else {
      console.warn('Firebase is not configured. Set the VITE_FIREBASE_* variables to enable uploads.');
    }
  }

  private initializeFirebase(): void {
    const env = ((import.meta as any)?.env ?? {}) as Record<string, string | undefined>;
    const config = {
      apiKey: env['VITE_FIREBASE_API_KEY'] || 'AIzaSyCc6D09lKdSJEey3a_15ZBbJhSFss-mOs4',
      authDomain: env['VITE_FIREBASE_AUTH_DOMAIN'] || 'map-dk-31405.firebaseapp.com',
      projectId: env['VITE_FIREBASE_PROJECT_ID'] || 'map-dk-31405',
      messagingSenderId: env['VITE_FIREBASE_MESSAGING_SENDER_ID'] || '419775459904',
      appId: env['VITE_FIREBASE_APP_ID'] || '1:419775459904:web:eedb1f02206f88bb3b65a5',
    };

    this.firebaseConfigured = Object.values(config).every((value) => typeof value === 'string' && value.trim());
    if (!this.firebaseConfigured) {
      return;
    }

    const app = getApps().length ? getApp() : initializeApp(config);
    this.firestore = getFirestore(app);
  }

  private loadPhotosFromFirebase(): void {
    const firestore = this.requireFirestore();
    const photosQuery = query(collection(firestore, 'photos'), orderBy('uploadedAt', 'desc'));

    onSnapshot(
      photosQuery,
      (snapshot) => {
        const photos = snapshot.docs.map((snapshotDoc) => {
          return this.firebaseDocToPhoto(snapshotDoc.id, snapshotDoc.data() as FirebasePhotoRecord);
        });
        this.photosSubject.next(photos);
      },
      (error) => {
        console.error('Failed to load photos from Firebase:', error);
      }
    );
  }

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
      .then(async (geoResult) => {
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
        await updateDoc(doc(this.requireFirestore(), 'photos', id), {
          locationName: updatedPhoto.locationName,
          address: updatedPhoto.address || {},
        }).catch((error) => {
          console.warn('Failed to persist location details to Firebase:', error);
        });
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

  async uploadPhoto(
    file: File,
    lat: number,
    lng: number,
    exifData: ExifData = {},
    addressData: PhotoAddress = {},
    locationName?: string,
    title?: string
  ): Promise<PhotoLocation> {
    const firestore = this.requireFirestore();
    const photoRef = doc(collection(firestore, 'photos'));

    const fileDataUrl = await this.fileToDataUrl(file);
    const uploadedAt = new Date().toISOString();
    const fileName = title || file.name;
    const resolvedLocationName = locationName || fileName;

    const photoRecord: FirebasePhotoRecord = {
      fileName,
      fileDataUrl,
      lat,
      lng,
      uploadedAt,
      locationName: resolvedLocationName,
      address: addressData,
      exifData,
    };

    await setDoc(photoRef, photoRecord);

    const photo = this.firebaseDocToPhoto(photoRef.id, photoRecord);
    const currentPhotos = this.photosSubject.value.filter((item) => item.id !== photo.id);
    this.photosSubject.next([photo, ...currentPhotos]);
    return photo;
  }

  async prepareUploadFile(file: File): Promise<File> {
    let workingFile = file;

    if (this.isHeicFile(workingFile)) {
      workingFile = await this.convertHeicToJpeg(workingFile);
    }

    const maxBytes = 680 * 1024;
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

  async removePhoto(id: string): Promise<void> {
    const photo = this.getPhotoById(id);
    if (!photo) {
      return;
    }

    await deleteDoc(doc(this.requireFirestore(), 'photos', id));

    const currentPhotos = this.photosSubject.value.filter((p) => p.id !== id);
    this.photosSubject.next(currentPhotos);
  }

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

  private firebaseDocToPhoto(id: string, data: FirebasePhotoRecord): PhotoLocation {
    return {
      id,
      fileName: data.fileName || 'Photo',
      fileDataUrl: typeof data.fileDataUrl === 'string' ? data.fileDataUrl : '',
      lat: Number(data.lat),
      lng: Number(data.lng),
      timestamp: data.uploadedAt ? new Date(data.uploadedAt) : undefined,
      locationName: this.preferredLocationName(data),
      exifData: data.exifData || {},
      address: data.address || {},
    };
  }

  private preferredLocationName(data: FirebasePhotoRecord): string | undefined {
    return data.locationName
      || data.address?.village
      || data.address?.town
      || data.address?.city
      || data.address?.county
      || data.address?.state
      || data.address?.country
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

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firebase Firestore is not configured. Add the VITE_FIREBASE_* variables first.');
    }

    return this.firestore;
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file as data URL'));
      reader.readAsDataURL(file);
    });
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

# Angular Photo Map - Backend Integration Guide

## Overview

The application now supports both **localStorage** (local browser storage) and **Statamic backend** (shared server storage) for storing and retrieving photos.

### Current Setup

- **Local Storage**: Uses `photo.service.ts` (all data stored in browser)
- **Backend Storage**: Uses `photo-backend.service.ts` (connected to Statamic server)

## Switching to Backend

### Step 1: Update the Upload Component

In `src/app/components/upload/upload.component.ts`, change the import:

```typescript
// CHANGE FROM THIS:
import { PhotoService } from '../../services/photo.service';

// TO THIS:
import { PhotoBackendService } from '../../services/photo-backend.service';
```

Then update the service injection:

```typescript
// CHANGE FROM THIS:
constructor(private photoService: PhotoService) {}

// TO THIS:
constructor(private photoService: PhotoBackendService) {}
```

### Step 2: Update the Map Component

In `src/app/components/map/map.component.ts`, change the import similarly:

```typescript
// CHANGE FROM THIS:
import { PhotoService } from '../../services/photo.service';

// TO THIS:
import { PhotoBackendService } from '../../services/photo-backend.service';
```

Update the service injection in the component constructor.

### Step 3: Ensure Backend is Running

Start the Statamic backend before running the Angular app:

```bash
# Terminal 1: Start backend
cd backend
php artisan serve --host=localhost --port=8000

# Terminal 2: Start Angular app
ng serve
```

### Step 4: Test the Integration

1. Open `http://localhost:4200` in your browser
2. Upload a photo with GPS metadata
3. Check the browser console for any CORS or API errors  
4. Photos should appear on the map
5. Refresh the page - photos should still be there (persisted on backend)
6. Visit `http://localhost:8000/cp` to see photos in Statamic admin panel

## API Communication Flow

### Upload A Photo

```
┌─────────────┐
│ Angular App │ 
│  (4200)     │
└─────┬───────┘
      │ 1. File + EXIF metadata
      │ 2. POST /api/photos
      │
      ▼
┌──────────────────────────┐
│  Statamic Backend        │
│  (8000)                  │
│  - Validates file        │
│  - Stores in storage/    │
│  - Creates DB entry      │
│  - Returns entry data    │
└──────┬─────────────────┘
       │ 3. Return photo JSON
       │
       ▼
┌─────────────┐
│ Angular App │ Adds to map
└─────────────┘
```

### Fetch All Photos

```
┌─────────────┐
│ Angular App │ 
│  (4200)     │
└─────┬───────┘
      │ GET /api/photos
      │
      ▼
┌──────────────────────────┐
│  Statamic Backend        │
│  - Query database        │
│  - Build photo objects   │
│  - Return JSON array     │
└──────┬─────────────────────┘
       │ Return [photo, photo, ...]
       │
       ▼
┌─────────────┐
│ Angular App │ Renders pins on map
└─────────────┘
```

## Troubleshooting

### CORS Errors in Console

**Problem**: `Cross-Origin Request Blocked`

**Solution**: Verify `.env` in backend has correct origins:

```env
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:8000
```

### Network Errors: `Failed to fetch`

**Problem**: Backend server not running

**Solution**: Start backend with `php artisan serve --host=localhost --port=8000`

### Photos Not Appearing After Refresh

**Problem**: Multiple possible causes

**Solutions**:
1. Check browser DevTools → Network tab → `GET /api/photos` response
2. Verify database file exists: `backend/database/database.sqlite`
3. Check backend logs: `storage/logs/laravel.log`
4. Try clearing Angular cache: `ng serve --disable-cache`

### Upload Fails with 500 Error

**Problem**: Backend file storage issue

**Solutions**:
1. Ensure storage directory writable: `chmod -R 775 backend/storage`
2. Check backend logs for error details
3. Run migrations fresh: `php artisan migrate:fresh`

## Backend File Storage

Uploaded photos are stored in:

```
backend/
├── storage/
│   ├── app/
│   │   └── photos/
│   │       ├── uuid-filename-1.jpg
│   │       ├── uuid-filename-2.png
│   │       └── ...
│   └── logs/
```

They're accessible via: `http://localhost:8000/storage/photos/filename.jpg`

## Managing Photos

### Via Angular UI
1. Upload photos with the app
2. Click pins to view details
3. (Delete feature coming soon)

### Via Statamic Admin Panel
1. Navigate to `http://localhost:8000/cp`
2. Go to "Collections → Photos"
3. Create, edit, or delete photos directly
4. Manually add GPS coordinates or metadata
5. Changes immediately reflect in Angular app (after refresh)

## Database Schema

Photos are stored in Statamic entries with this structure:

```sql
-- Simplified representation
entry {
  id: uuid,
  collection: 'photos',
  title: 'Location Name',
  slug: 'location-name',
  data: {
    image: ['asset-id'],
    location_name: 'Budapest, Hungary',
    latitude: 47.4979,
    longitude: 19.0402,
    exif_camera_make: 'Canon',
    exif_camera_model: 'Canon EOS 5D',
    exif_iso: 1600,
    exif_focal_length: '50mm',
    exif_aperture: 'f/2.8',
    exif_shutter_speed: '1/125',
    exif_flash: false,
    address_village: null,
    address_town: 'Budapest',
    address_city: 'Budapest',
    address_county: 'Budapest',
    address_state: null,
    address_country: 'Hungary',
    address_postcode: '1234',
    date_taken: '2024-01-15T10:30:00',
  }
}
```

## Local Storage vs Backend

| Feature | localStorage | Backend |
|---------|--------------|---------|
| Shared across devices | ❌ | ✅ |
| Survives browser wipe | ❌ | ✅ |
| Capacity | ~5-10MB | Unlimited |
| Setup complexity | Simple | Moderate |
| Deployment | None | Needs server |
| Real-time sync | N/A | ✅ |
| Export/backup | Manual | Automated |

## Hybrid Approach

You can also use **both** - load from backend but fallback to localStorage:

```typescript
constructor(private photoBackendService: PhotoBackendService) {
  this.photoBackendService.getPhotos()
    .pipe(
      catchError(() => {
        console.log('Backend unavailable, loading from localStorage');
        return this.photoService.getPhotos();
      })
    )
    .subscribe(photos => this.photos = photos);
}
```

## Production Deployment

For deploying to a shared host:

1. **Backend**: Upload `backend/` folder to hosting
2. **Frontend**: Build Angular and upload to hosting
3. **Database**: Backup `database/database.sqlite` regularly
4. **CORS**: Update `.env` with production domain
5. **HTTPS**: Use SSL/TLS certificates for both frontend and backend
6. **Storage**: Consider cloud storage (S3, Azure) for scale

See [backend/SETUP.md](../backend/SETUP.md) for full backend deployment guide.

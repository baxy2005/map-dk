# Photo Map Backend - Statamic

This is the backend API server for the Photo Map application, built with Statamic (Laravel-based CMS).

## Setup

### Prerequisites
- PHP 8.1+
- Composer
- SQLite (included)

### Installation

```bash
cd backend

# Dependencies are already installed during project creation
# To reinstall if needed:
composer install

# Set up storage directories
mkdir -p storage/app/photos storage/logs
chmod -R 775 storage bootstrap/cache

# Link storage (for public file access)
php artisan storage:link
```

### Configuration

The `.env` file is pre-configured with:
- SQLite database
- API enabled on `/api/` routes
- CORS configured for `localhost:4200` (Angular dev server) and `localhost:8000` (this server)

## Running the Server

```bash
# Start the development server
php artisan serve --host=localhost --port=8000
```

The server will be available at `http://localhost:8000`

## API Endpoints

All photo endpoints are under `/api/photos/`:

### Get All Photos
```
GET /api/photos
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "photo-uuid",
      "title": "Location Name",
      "location_name": "Budapest, Hungary",
      "latitude": 47.4979,
      "longitude": 19.0402,
      "image_url": "/storage/photos/filename.jpg",
      "date_taken": "2024-01-15T10:30:00",
      "exif_data": {
        "make": "Canon",
        "model": "Canon EOS 5D",
        "iso": 1600,
        "focal_length": "50mm",
        "aperture": "f/2.8",
        "shutter_speed": "1/125",
        "flash": false
      },
      "address": {
        "village": null,
        "town": "Budapest",
        "city": "Budapest",
        "county": "Budapest",
        "state": null,
        "country": "Hungary",
        "postcode": "1234"
      }
    }
  ]
}
```

### Upload a Photo
```
POST /api/photos
Content-Type: multipart/form-data

Fields:
- image (File, required) - JPG/PNG/GIF/WebP image file
- location_name (String, optional) - Human-readable location
- latitude (Float, optional) - GPS latitude
- longitude (Float, optional) - GPS longitude
- exif_data (JSON, optional) - Camera metadata:
  {
    "exif_camera_make": "Canon",
    "exif_camera_model": "Canon EOS 5D",
    "exif_iso": 1600,
    "exif_focal_length": "50mm",
    "exif_aperture": "f/2.8",
    "exif_shutter_speed": "1/125",
    "exif_flash": false
  }
- address_data (JSON, optional) - Location breakdown:
  {
    "address_village": null,
    "address_town": "Budapest",
    "address_city": "Budapest",
    "address_county": "Budapest",
    "address_state": null,
    "address_country": "Hungary",
    "address_postcode": "1234"
  }
```

Response:
```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "data": { /* photo object */ }
}
```

### Get Single Photo
```
GET /api/photos/{id}
```

### Delete a Photo
```
DELETE /api/photos/{id}
```

## Managing Photos via Web UI

You can also manage photos through the Statamic admin panel:

1. **Access**: http://localhost:8000/cp
2. **Login**: (credentials set during setup)
3. **Navigate**: Collections → Photos
4. Create, edit, or delete photos with full metadata

## Connecting from Angular App

Update your Angular services to call the backend API instead of using localStorage:

```typescript
// In photo.service.ts
private apiUrl = 'http://localhost:8000/api/photos';

// Get all photos
getPhotos(): Observable<any> {
  return this.http.get(`${this.apiUrl}`);
}

// Upload a photo (existing metadata and image)
uploadPhoto(photoData: FormData): Observable<any> {
  return this.http.post(`${this.apiUrl}`, photoData);
}

// Delete a photo
deletePhoto(id: string): Observable<any> {
  return this.http.delete(`${this.apiUrl}/${id}`);
}
```

## Database

Statamic uses SQLite by default (file: `database/database.sqlite`).

Photos and all metadata are stored in the `entries` table with `collection_photos` scope.

### Backup Your Data

```bash
# Regular backup
cp database/database.sqlite database/database.backup.sqlite

# Or export JSON
php artisan export --folder=backups
```

## File Storage

- **Photos** (uploaded files): `storage/app/photos/`
- **Served publicly via**: `/storage/photos/filename.jpg`
- **Disk config**: `config/filesystems.php` (photos disk)

## Troubleshooting

### Photos aren't showing
- Check that `storage/app/photos/` directory exists and is writable
- Run: `php artisan storage:link` to create public symlink
- Check API response in browser DevTools

### CORS errors
- Verify `.env` has correct `CORS_ALLOWED_ORIGINS`
- Check `config/cors.php` includes your Angular dev server URL
- Ensure API middleware is active in `routes/api.php`

### Database errors
- Delete `database/database.sqlite` to reset
- Re-run migrations: `php artisan migrate --fresh`

## Production Deployment

For production (shared host):

1. **Environment**: Update `.env` with production values
2. **Storage**: Consider cloud storage (S3, Azure Blob) instead of local
3. **Security**: Enable API authentication (add Laravel Sanctum)
4. **Performance**: Enable caching, enable asset compression
5. **Backups**: Set up database backups

See Statamic docs: https://statamic.dev/

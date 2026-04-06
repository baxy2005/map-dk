# Photo Map - Complete Setup Guide

Your Photo Map application is now set up with a **Statamic backend** for shared file storage! 

## 📁 Project Structure

```
myproject/
├── src/                          # Angular frontend
│   ├── app/
│   │   ├── components/
│   │   │   ├── map/             # Map display component
│   │   │   └── upload/          # Photo upload component  
│   │   ├── services/
│   │   │   ├── photo.service.ts          # localStorage version
│   │   │   ├── photo-backend.service.ts  # Backend API version (NEW)
│   │   │   └── map.service.ts
│   │   └── models/
│   │       └── photo.model.ts
│   └── styles/
├── backend/                      # Statamic CMS backend (NEW)
│   ├── app/
│   │   └── Http/Controllers/
│   │       └── PhotoApiController.php    # Photo API endpoints
│   ├── content/
│   │   └── collections/
│   │       └── photos.yaml               # Photos collection config
│   ├── config/
│   │   ├── cors.php             # CORS configuration
│   │   └── filesystems.php      # Storage disk config
│   ├── database/
│   │   └── database.sqlite      # SQLite database
│   ├── routes/
│   │   └── api.php              # API routes (NEW)
│   ├── storage/
│   │   ├── app/photos/          # Uploaded photo files
│   │   └── logs/
│   ├── .env                     # Backend environment (API enabled)
│   ├── SETUP.md                 # Backend setup instructions
│   └── composer.json
├── BACKEND_INTEGRATION.md        # Integration guide (NEW)
├── start.sh                      # Startup script (NEW)
├── start.bat                     # Windows startup script (NEW)
├── angular.json
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for Angular)
- **PHP** 8.1+ (for Statamic backend)
- **Composer** (PHP package manager)

### Option A: Automatic (Recommended)

**macOS/Linux:**
```bash
cd /path/to/myproject
./start.sh
```

This will start both backend and frontend automatically.

**Windows:**
```bash
cd C:\path\to\myproject
start.bat
```

### Option B: Manual

**Terminal 1 - Start Backend:**
```bash
cd backend
php artisan serve --host=localhost --port=8000
```

**Terminal 2 - Start Frontend:**
```bash
# from project root
ng serve
```

### Visit the App

- **Frontend**: http://localhost:4200
- **Backend Admin**: http://localhost:8000/cp
- **API**: http://localhost:8000/api/photos

## 🔧 First Time Setup

If the backend wasn't fully initialized, run these commands:

```bash
cd backend

# Install dependencies (if needed)
composer install

# Run migrations
php artisan migrate

# Create storage links
php artisan storage:link

# Create necessary directories
mkdir -p storage/app/photos storage/logs
```

## 📤 Uploading Photos

1. Navigate to http://localhost:4200
2. Click "📁 Choose Files" or drag photos onto the upload area
3. Select JPG/PNG/GIF images with GPS metadata (EXIF)
4. Photos appear as pins on the map
5. Click pins to view full metadata and location details
6. **Data persists** - refresh the page, photos stay!

## 💾 Storage Options

### Current Setup: Local Files + SQLite Database

**Pros:**
- ✅ No additional services needed
- ✅ Works on any shared hosting
- ✅ Easy to backup

**Cons:**
- ⚠️ Limited to disk space
- ⚠️ Not ideal for 100,000+ photos

**Solution for scaling:**
- Use cloud storage (AWS S3, Azure Blob, Google Cloud Storage)
- Update `backend/config/filesystems.php` to use S3 disk
- Update `.env` with cloud credentials

## 🔀 Switching Storage Methods

### Use Backend (Shared Server Storage) - RECOMMENDED
✅ Recommended for production and shared hosting

Edit `src/app/components/upload/upload.component.ts`:
```typescript
import { PhotoBackendService } from '../../services/photo-backend.service';
```

Edit `src/app/components/map/map.component.ts`:
```typescript
import { PhotoBackendService } from '../../services/photo-backend.service';
```

### Use localStorage (Browser Only)
❌ Only use for local testing

Edit components to use:
```typescript
import { PhotoService } from '../../services/photo.service';
```

## 🌐 Deployment to Shared Hosting

### Host Provider Requirements
- PHP 8.1+ support
- Composer available (or dependencies pre-installed)
- SSH access (recommended)
- At least 500MB storage

### Deployment Steps

1. **Prepare the backend:**
   ```bash
   cd backend
   composer install --no-dev --optimize-autoloader
   ```

2. **Upload via SFTP/Git:**
   - Upload entire project to hosting
   - Or: push to Git, deploy from hosting control panel

3. **Configure on Server:**
   ```bash
   # Connect via SSH
   cd /path/to/myproject/backend
   
   # Set up environment
   cp .env.example .env
   php artisan key:generate
   php artisan migrate
   php artisan storage:link
   
   # Set permissions
   chmod -R 755 storage bootstrap/cache public
   ```

4. **Update CORS:**
   Edit `backend/.env`:
   ```env
   CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

5. **Build Angular:**
   ```bash
   cd /path/to/myproject
   ng build --configuration=production
   ```
   Upload the `dist/` folder to your hosting.

6. **Update API URL:**
   Create `src/environments/environment.prod.ts`:
   ```typescript
   export const environment = {
     apiUrl: 'https://api.yourdomain.com/api',
     production: true
   };
   ```

## 🛠️ Admin Panel

Access the Statamic admin panel to manage photos without the Angular app:

1. Visit http://localhost:8000/cp
2. Login with your credentials
3. Navigate to **Collections → Photos**
4. Create, edit, or delete entries
5. Upload photos directly
6. Manage metadata

## 📊 Database & Backups

### Backup Local Database

**Automatic approach:**
```bash
# Copy database file
cp backend/database/database.sqlite backend/database/database.backup.sqlite
```

**Export to JSON:**
```bash
cd backend
php artisan export --folder=backups
```

### Restore from Backup

```bash
cp backend/database/database.backup.sqlite backend/database/database.sqlite
```

### For Cloud Storage

Statamic supports automatic backups to S3, Azure, etc.
See: https://statamic.dev/addons

## 🔐 Security

### For Local Development
No additional setup needed - localhost is isolated.

### For Production

1. **Enable HTTPS**: Use SSL certificate from Let's Encrypt (free)
2. **Secure .env**: Never commit `.env` files with secrets
3. **Database backups**: Encrypt and store securely
4. **Rate limiting**: Already enabled in API routes
5. **CORS**: Restrict to your domain only
6. **Authentication**: (Optional) Add API keys for upload access

## 🐛 Troubleshooting

### Photos not loading?
```bash
# Check backend is running
curl http://localhost:8000/api/photos

# Check database
cd backend && sqlite3 database/database.sqlite ".tables"
```

### CORS errors?
Update `CORS_ALLOWED_ORIGINS` in `backend/.env` to include your domain.

### No storage permissions?
```bash
chmod -R 755 backend/storage backend/bootstrap/cache
```

### Can't connect to backend?
1. Verify backend is running on port 8000
2. Check firewall settings
3. Verify `.env` URLs are correct

## 📚 Documentation

- **Angular App**: See [README.md](README.md)
- **Backend API**: See [backend/SETUP.md](backend/SETUP.md)
- **Integration Guide**: See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)
- **Statamic Docs**: https://statamic.dev/
- **Angular Docs**: https://angular.io/

## 🤝 Support

Issues? Check the logs:

**Frontend errors:**
```
Browser → DevTools → Console
```

**Backend errors:**
```bash
cat backend/storage/logs/laravel.log
```

## 📝 Next Steps

1. ✅ Verify both servers are running
2. ✅ Check photos upload successfully
3. ✅ Ensure data persists after refresh
4. ✅ Test on your shared hosting environment
5. ✅ Set up automated backups
6. ✅ Configure production domain names
7. ✅ Enable HTTPS certificates

Happy mapping! 🗺️📍

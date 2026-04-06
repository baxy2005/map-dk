# Deployment

This project is set up for a split deployment:

1. Frontend on Vercel
2. Backend on an Oracle Cloud Always Free VM
3. DNS on Cloudflare
4. TLS via Let's Encrypt

## Architecture

- Frontend: static Angular app built from the repository root
- Backend: Laravel + Statamic app served from `backend/public`
- Storage: local filesystem on the Oracle VM for hobby use

## Frontend on Vercel

### Vercel project settings

- Framework preset: `Other`
- Root directory: repository root
- Build command: `npm run build`
- Output directory: `dist/myproject/browser`

The repo already includes [vercel.json](vercel.json) and [.vercelignore](.vercelignore).

### Required Vercel environment variable

Set this in Vercel before the first production deploy:

```bash
VITE_API_URL=https://api.your-domain.com/api/photos
```

Example:

```bash
VITE_API_URL=https://api.photomap.example.com/api/photos
```

### Vercel domain

- Attach your frontend domain in Vercel, for example `map.example.com`

## Backend on Oracle Cloud VM

### VM recommendation

- Ubuntu 24.04 LTS
- Open ports: `80`, `443`, `22`

### Packages

Install:

```bash
sudo apt update
sudo apt install -y nginx unzip git curl sqlite3 php8.3 php8.3-fpm php8.3-cli php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-sqlite3 php8.3-bcmath php8.3-intl composer certbot python3-certbot-nginx
```

### App deployment

Clone the repo and deploy the backend folder on the VM:

```bash
git clone <your-repository-url> myproject
cd myproject/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
mkdir -p database
touch database/database.sqlite
php artisan storage:link
php artisan optimize:clear
```

### Backend environment

Set these values in `backend/.env`:

```bash
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.your-domain.com
FRONTEND_URL=https://map.your-domain.com

DB_CONNECTION=sqlite
SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
```

For the current hobby setup, SQLite and local filesystem storage are acceptable.

### Nginx site config

Use a server block that points the document root at `backend/public`.

Example:

```nginx
server {
    server_name api.your-domain.com;
    root /var/www/myproject/backend/public;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

Then enable and reload Nginx.

### Let's Encrypt

After DNS points to the VM:

```bash
sudo certbot --nginx -d api.your-domain.com
```

## Cloudflare

Recommended DNS layout:

- `map.example.com` -> Vercel
- `api.example.com` -> Oracle VM public IP

You can use Cloudflare's free DNS and proxy options.

## Post-deploy checks

### Backend

Verify these work:

```bash
curl https://api.your-domain.com/api/photos
curl -I https://api.your-domain.com/storage
```

### Frontend

Open the Vercel site and verify:

- photo list loads from the backend
- upload works
- images render from the backend domain
- CORS is accepted from the frontend domain

## Notes

- Vercel preview deployments are allowed by backend CORS via the `*.vercel.app` pattern.
- For production durability, the next upgrade should be moving photo assets to S3-compatible storage.
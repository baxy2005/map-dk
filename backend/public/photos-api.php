<?php
/**
 * Photo Map API - Standalone endpoint (bypasses Statamic)
 * Access via: /photos-api.php
 */

// Set proper headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Bootstrap Laravel
    require __DIR__ . '/bootstrap/app.php';
    $app = require __DIR__ . '/bootstrap/app.php';
    
    // Get the request path and method
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = str_replace('/photos-api.php', '', $path);
    
    // Route the requests
    if (empty($path) || $path === '/') {
        // GET /photos-api.php - list all photos
        if ($method === 'GET') {
            // Get all photos from database
            $entries = \Statamic\Facades\Entry::query()
                ->where('collection', 'photos')
                ->get();
            
            $photos = $entries->map(fn($entry) => [
                'id' => $entry->id(),
                'title' => $entry->get('title'),
                'location_name' => $entry->get('location_name'),
                'latitude' => (float) $entry->get('latitude'),
                'longitude' => (float) $entry->get('longitude'),
                'image_url' => $entry->get('image')[0] ?? null,
                'exif_data' => [
                    'make' => $entry->get('exif_camera_make'),
                    'model' => $entry->get('exif_camera_model'),
                    'iso' => $entry->get('exif_iso'),
                    'focal_length' => $entry->get('exif_focal_length'),
                ],
                'address' => [
                    'city' => $entry->get('address_city'),
                    'country' => $entry->get('address_country'),
                ]
            ])->all();
            
            echo json_encode(['success' => true, 'data' => $photos]);
            exit;
        }
        
        // POST /photos-api.php - upload new photo
        if ($method === 'POST') {
            echo json_encode(['success' => true, 'message' => 'Upload successful']);
            exit;
        }
    }
    
    // Single photo routes
    if (preg_match('/^\/(\w+)$/', $path, $matches)) {
        $id = $matches[1];
        
        if ($method === 'GET') {
            $entry = \Statamic\Facades\Entry::find($id);
            if (!$entry) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Photo not found']);
                exit;
            }
            echo json_encode(['success' => true, 'data' => $entry->data()->all()]);
            exit;
        }
        
        if ($method === 'DELETE') {
            $entry = \Statamic\Facades\Entry::find($id);
            if ($entry) {
                $entry->delete();
                echo json_encode(['success' => true, 'message' => 'Deleted']);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Not found']);
            }
            exit;
        }
    }
    
    // Default - not found
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
    
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

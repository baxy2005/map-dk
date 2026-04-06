<?php

namespace App\Http\Controllers;

use Statamic\Facades\Entry;
use Statamic\Facades\Asset;
use Statamic\Facades\AssetContainer;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class PhotoApiController extends Controller
{
    /**
     * Get all photos
     */
    public function index()
    {
        try {
            $photos = Entry::query()
                ->where('collection', 'photos')
                ->get()
                ->map(fn($entry) => $this->formatPhoto($entry))
                ->all();

            return response()->json([
                'success' => true,
                'data' => $photos,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }
    }

    /**
     * Store a new photo
     */
    public function store(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,jpg,png,gif,webp|max:51200',
            'title' => 'nullable|string',
            'location_name' => 'nullable|string',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'date_taken' => 'nullable|date',
            'exif_data' => 'nullable',
            'address_data' => 'nullable',
        ]);

        $exifData = $this->decodePayload($request->input('exif_data'));
        $addressData = $this->decodePayload($request->input('address_data'));
        $latitude = $request->input('latitude');
        $longitude = $request->input('longitude');

        if ($latitude !== null && $longitude !== null) {
            $existingEntry = $this->findExistingPhotoByCoordinates((float) $latitude, (float) $longitude);

            if ($existingEntry) {
                return response()->json([
                    'success' => false,
                    'message' => 'A photo with the same GPS coordinates already exists.',
                    'data' => $this->formatPhoto($existingEntry),
                ], 409);
            }
        }

        try {
            // Upload image to assets
            $container = AssetContainer::find('photos');
            if (!$container) {
                $container = AssetContainer::make('photos')
                    ->disk('photos')
                    ->title('Photos');
                $container->save();
            }

            $file = $request->file('image');
            $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('', $filename, 'photos');

            // Create asset
            $asset = Asset::make()
                ->path($path)
                ->container('photos');
            $asset->save();

            // Create entry
            $entry = Entry::make()
                ->collection('photos')
                ->slug(Str::slug($request->input('location_name', 'photo-' . now()->timestamp)))
                ->data([
                    'title' => $request->input('title', 'Photo - ' . now()->format('Y-m-d H:i')),
                    'image' => [$asset->id()],
                    'location_name' => $request->input('location_name'),
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'date_taken' => $request->input('date_taken', now()),
                    ...$exifData,
                    ...$addressData,
                ]);
            $entry->save();

            return response()->json([
                'success' => true,
                'message' => 'Photo uploaded successfully',
                'data' => $this->formatPhoto($entry),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload photo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a single photo
     */
    public function show($id)
    {
        $entry = Entry::find($id);

        if (!$entry || $entry->collection() !== 'photos') {
            return response()->json([
                'success' => false,
                'message' => 'Photo not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatPhoto($entry),
        ]);
    }

    /**
     * Delete a photo
     */
    public function destroy($id)
    {
        $entry = Entry::find($id);

        if (!$entry || $entry->collection() !== 'photos') {
            return response()->json([
                'success' => false,
                'message' => 'Photo not found',
            ], 404);
        }

        try {
            $images = $entry->get('image', []);
            foreach (Arr::wrap($images) as $assetId) {
                if ($asset = Asset::find($assetId)) {
                    $asset->delete();
                }
            }

            $entry->delete();

            return response()->json([
                'success' => true,
                'message' => 'Photo deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete photo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Format photo for API response
     */
    private function formatPhoto($entry)
    {
        $images = $entry->get('image', []);
        $imageUrl = '';

        if (is_array($images) && count($images) > 0) {
            $asset = Asset::find($images[0]);
            if ($asset) {
                $imageUrl = $asset->url();
            }
        }

        return [
            'id' => $entry->id(),
            'title' => $entry->get('title'),
            'location_name' => $entry->get('location_name'),
            'latitude' => (float) $entry->get('latitude'),
            'longitude' => (float) $entry->get('longitude'),
            'image_url' => $imageUrl,
            'date_taken' => $entry->get('date_taken'),
            'exif_data' => [
                'make' => $entry->get('exif_camera_make'),
                'model' => $entry->get('exif_camera_model'),
                'iso' => $entry->get('exif_iso'),
                'focal_length' => $entry->get('exif_focal_length'),
                'aperture' => $entry->get('exif_aperture'),
                'shutter_speed' => $entry->get('exif_shutter_speed'),
                'flash' => $entry->get('exif_flash'),
            ],
            'address' => [
                'village' => $entry->get('address_village'),
                'town' => $entry->get('address_town'),
                'city' => $entry->get('address_city'),
                'county' => $entry->get('address_county'),
                'state' => $entry->get('address_state'),
                'country' => $entry->get('address_country'),
                'postcode' => $entry->get('address_postcode'),
            ],
        ];
    }

    private function decodePayload($payload): array
    {
        if (is_array($payload)) {
            return $payload;
        }

        if (! is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function findExistingPhotoByCoordinates(float $latitude, float $longitude)
    {
        $tolerance = 0.000001;

        return Entry::query()
            ->where('collection', 'photos')
            ->get()
            ->first(function ($entry) use ($latitude, $longitude, $tolerance) {
                $entryLatitude = $entry->get('latitude');
                $entryLongitude = $entry->get('longitude');

                if ($entryLatitude === null || $entryLongitude === null) {
                    return false;
                }

                return abs((float) $entryLatitude - $latitude) <= $tolerance
                    && abs((float) $entryLongitude - $longitude) <= $tolerance;
            });
    }
}

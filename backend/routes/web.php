<?php

use App\Http\Controllers\PhotoApiController;
use Illuminate\Support\Facades\Route;

// Photo API - Custom routes to avoid Statamic Pro requirement
// Available at BOTH /photos-api and /api/photos for convenience
Route::middleware(['web', 'throttle:60,1'])->group(function () {
    // Primary endpoint
    Route::prefix('photos-api')->name('photos.')->group(function () {
        Route::get('/', [PhotoApiController::class, 'index'])->name('index');
        Route::post('/', [PhotoApiController::class, 'store'])->name('store');
        Route::get('/{id}', [PhotoApiController::class, 'show'])->name('show');
        Route::delete('/{id}', [PhotoApiController::class, 'destroy'])->name('delete');
    });
    
    // Alias for compatibility with standard /api/photos path
    Route::prefix('api/photos')->name('api.photos.')->group(function () {
        Route::get('/', [PhotoApiController::class, 'index'])->name('index');
        Route::post('/', [PhotoApiController::class, 'store'])->name('store');
        Route::get('/{id}', [PhotoApiController::class, 'show'])->name('show');
        Route::delete('/{id}', [PhotoApiController::class, 'destroy'])->name('delete');
    });
});

// Statamic Routes (keep this at the end)
// Route::statamic('example', 'example-view', [
//    'title' => 'Example'
// ]);

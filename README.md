# Angular Map Photo Uploader

A modern Angular application that displays uploaded photos on a map based on their GPS coordinates extracted from EXIF metadata. Perfect for photographers and travelers who want to visualize the locations where their photos were taken.

**Uses OpenStreetMap (Leaflet) - No API key needed!**

## Features

- 📍 **Interactive OpenStreetMap Display** - View all uploaded photos on an open-source map with custom markers
- 📸 **Photo Upload** - Upload photos using drag-and-drop or file selection
- 📊 **EXIF Metadata Extraction** - Automatically extract GPS coordinates and camera metadata from images
- 🎯 **Clickable Markers** - Click any map pin to view the photo and its detailed metadata
- 💎 **Google-like UI** - Clean, modern interface inspired by Google's design principles
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🗑️ **Photo Management** - Delete photos directly from the application
- 🆓 **Free & Open Source** - No API keys required, powered by OpenStreetMap and Leaflet

## Tech Stack

- **Angular 21** - Modern standalone components
- **TypeScript** - Type-safe development
- **Leaflet** - Interactive map library
- **OpenStreetMap** - Free map tiles
- **EXIF.js** - EXIF metadata extraction
- **SCSS** - Responsive styling

## Prerequisites

- Node.js (v18 or higher)
- npm (v10 or higher)
- No API keys needed! ✨

## Installation

1. Navigate to the project directory:
```bash
cd /Users/user/Documents/myproject
```

2. Install dependencies:
```bash
npm install
```

That's it! No API key configuration needed.

## Development

Start the development server:
```bash
npm start
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically hot-reload when you make changes.

## Building

Compile the project for production:
```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
src/app/
├── components/
│   ├── map/              # Map display and photo card component
│   │   ├── map.component.ts
│   │   ├── map.component.html
│   │   └── map.component.scss
│   └── upload/           # File upload interface
│       ├── upload.component.ts
│       ├── upload.component.html
│       └── upload.component.scss
├── services/
│   ├── map.service.ts    # Leaflet/OpenStreetMap integration
│   └── photo.service.ts  # Photo and EXIF data management
├── models/
│   └── photo.model.ts    # TypeScript interfaces
├── app.ts               # Root component
├── app.html             # Main template
└── app.scss             # Global styles
```

## Usage

1. **Upload Photos**:
   - Click "Choose Files" button or drag-and-drop images
   - The app will read EXIF metadata automatically
   - Only photos with GPS data will be added to the map

2. **View on Map**:
   - Uploaded photos appear as pins on the map
   - The map automatically zooms to show all photos
   - Powered by free OpenStreetMap tiles

3. **View Details**:
   - Click any map pin to see the photo and metadata
   - Camera information, focal length, ISO, and timestamp are displayed
   - Close the card by clicking the X button

4. **Delete Photos**:
   - Click the "Delete Photo" button in the photo card to remove it

## Map Provider

This application uses:
- **Leaflet** - A lightweight open-source mapping library
- **OpenStreetMap** - Free collaborative map tiles
- No API key required, no rate limits, completely free to use and self-host

## Supported Image Formats

The application supports standard image formats with EXIF data:
- JPEG (.jpg, .jpeg)
- PNG (.png) - if EXIF data is embedded
- WebP (.webp) - if EXIF data is embedded

## Browser Compatibility

- Chrome/Edge (v90+)
- Firefox (v88+)
- Safari (v14+)

## Performance

The application is optimized for:
- Lazy loading of map library
- Efficient marker management
- Minimal re-renders with Angular signals
- Responsive image handling

## Troubleshooting

### "No GPS data found in image"
- Ensure your photos have GPS location data embedded
- Use photos taken with a GPS-enabled camera or smartphone
- Some image editing software may strip EXIF data

### Map not loading or tiles not appearing
- Check your internet connection (OpenStreetMap tiles are fetched from the web)
- Check browser console for any errors
- Try refreshing the page

### Photos not appearing on map
- Verify photos have valid GPS coordinates in EXIF data
- Check the browser console for any JavaScript errors
- Ensure coordinates are within valid latitude/longitude ranges (-90 to 90 for latitude, -180 to 180 for longitude)

## Advantages Over Commercial Maps

✅ **No API key required** - Works out of the box  
✅ **No rate limits** - Use as much as you want  
✅ **Free to host** - Self-host without restrictions  
✅ **Open source** - Transparency and control  
✅ **Community maintained** - OpenStreetMap has vibrant community support  
✅ **Privacy friendly** - No tracking by map provider  

## Future Enhancements

- [ ] Clustering for large numbers of markers
- [ ] Photo filtering by date range or location
- [ ] Export photo locations as KML/GPX
- [ ] Drawing tools for routes and areas
- [ ] Photo gallery view
- [ ] Integration with cloud storage
- [ ] Offline map support

## License

MIT

## Attribution

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors  
Map library: [Leaflet](https://leafletjs.com/)

## Author

Created with ❤️ for photographers and travelers

## Support

For issues, questions, or contributions, please refer to the project documentation.

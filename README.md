# Virtual Glasses Application

A virtual try-on application for glasses using Angular and MediaPipe Face Mesh.

## Features

- Virtual glasses try-on using webcam
- Face detection and landmark tracking
- Multiple glasses models
- Photo capture functionality
- Responsive design

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   ng serve
   ```

## MediaPipe Error Handling

The application includes robust error handling for MediaPipe Face Mesh initialization issues:

### Common Issues

1. **WebAssembly Runtime Error**: This can occur when MediaPipe fails to load from CDN
2. **Network Issues**: CDN connectivity problems
3. **Browser Compatibility**: Some browsers may have issues with WebAssembly

### Fallback Mode

The application automatically switches to fallback mode when MediaPipe fails to load:
- Camera still works
- Glasses are displayed in the center of the screen
- No face tracking, but basic functionality is preserved

### Troubleshooting

If you encounter MediaPipe errors:

1. **Check Network Connection**: Ensure stable internet connection
2. **Try Different Browser**: Use Chrome or Firefox
3. **Clear Browser Cache**: Clear cache and reload
4. **Check Console**: Look for specific error messages in browser console

### Error Recovery

The application includes:
- Automatic retry logic (3 attempts)
- Multiple CDN fallbacks
- Graceful degradation to fallback mode
- Comprehensive error logging

## Usage

1. Click "Activer la caméra" to start the webcam
2. Select glasses from the sidebar
3. Position your face in the camera view
4. Use "Prendre une photo" to capture the result
5. Download the photo if desired

## Technical Details

- **Frontend**: Angular 19
- **Face Detection**: MediaPipe Face Mesh
- **3D Models**: Three.js with GLTF loader
- **Styling**: Bootstrap 5

## Browser Support

- Chrome (recommended)
- Firefox
- Safari (limited support)
- Edge

## Development

The application uses:
- Angular standalone components
- RxJS for reactive programming
- MediaPipe for face detection
- Three.js for 3D rendering

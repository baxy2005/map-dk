import { Component } from '@angular/core';
import { MapComponent } from './components/map/map.component';
import { UploadComponent } from './components/upload/upload.component';
import { PhotoLocation } from './models/photo.model';

@Component({
  selector: 'app-root',
  imports: [MapComponent, UploadComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  selectedPhoto: PhotoLocation | null = null;

  onPhotoSelected(photo: PhotoLocation): void {
    this.selectedPhoto = photo;
  }
}

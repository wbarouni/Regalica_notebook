import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upload-dropzone',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="upload-dropzone" 
         (dragover)="onDragOver($event)"
         (dragleave)="onDragLeave($event)"
         (drop)="onDrop($event)">
      <div class="upload-content">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <p class="upload-text">Drop files here or click to upload</p>
        <input type="file" 
               #fileInput
               (change)="onFileSelect($event)"
               multiple
               accept=".pdf,.docx,.txt,.html"
               class="file-input">
        <button class="upload-btn" (click)="fileInput.click()">
          Choose Files
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-dropzone {
      border: 2px dashed #d1d5db;
      border-radius: 0.5rem;
      padding: 2rem;
      text-align: center;
      transition: all 0.2s;
      cursor: pointer;
    }
    
    .upload-dropzone:hover {
      border-color: #9ca3af;
      background-color: #f9fafb;
    }
    
    .upload-content svg {
      margin: 0 auto 1rem;
      color: #6b7280;
    }
    
    .upload-text {
      margin: 0 0 1rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .file-input {
      display: none;
    }
    
    .upload-btn {
      background: #111827;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .upload-btn:hover {
      background: #374151;
    }
  `]
})
export class UploadDropzoneComponent {
  @Output() uploadComplete = new EventEmitter<void>();
  @Output() uploadError = new EventEmitter<string>();

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(files);
    }
  }

  onFileSelect(event: Event): void {
    const files = event.target.files;
    if (files) {
      this.handleFiles(files);
    }
  }

  private handleFiles(): void {
    // Simulation d'upload pour le moment
    
    this.uploadComplete.emit({ message: 'Upload completed' });
  }
}

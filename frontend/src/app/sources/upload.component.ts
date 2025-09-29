import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IngestService, UploadResult } from '../services/ingest.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg border border-gray-200 p-6" data-testid="upload-component">
      <h3 class="text-lg font-semibold text-black mb-4">Upload Document</h3>
      
      <!-- Drag & Drop Zone -->
      <div 
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors"
        [class.border-blue-500]="isDragOver"
        [class.bg-blue-50]="isDragOver"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        data-testid="drop-zone"
      >
        <div class="space-y-4">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          
          <div>
            <p class="text-lg text-gray-600">Glissez-déposez votre fichier ici</p>
            <p class="text-sm text-gray-500 mt-1">ou</p>
          </div>
          
          <label class="inline-flex items-center px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
            <span>Choisir un fichier</span>
            <input 
              type="file" 
              class="hidden" 
              [accept]="acceptedTypes"
              (change)="onFileSelected($event)"
              data-testid="file-input"
            />
          </label>
          
          <p class="text-xs text-gray-500">
            Formats supportés: PDF, DOCX, HTML, TXT (max {{ maxSizeMb }}MB)
          </p>
        </div>
      </div>
      
      <!-- Selected File Info -->
      <div *ngIf="selectedFile && !isUploading" class="mt-4 p-4 bg-gray-50 rounded-md" data-testid="selected-file">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-black">{{ selectedFile.name }}</p>
            <p class="text-sm text-gray-600">{{ formatFileSize(selectedFile.size) }}</p>
          </div>
          <button 
            (click)="clearSelection()"
            class="text-red-600 hover:text-red-800"
            data-testid="clear-file"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <button 
          (click)="uploadFile()"
          class="mt-3 w-full py-2 px-4 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
          data-testid="upload-button"
        >
          Upload Document
        </button>
      </div>
      
      <!-- Upload Progress -->
      <div *ngIf="isUploading" class="mt-4" data-testid="upload-progress">
        <div class="flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
          <span class="text-gray-700">{{ uploadStatus }}</span>
        </div>
        <div class="mt-2 bg-gray-200 rounded-full h-2">
          <div class="bg-black h-2 rounded-full transition-all duration-300" [style.width.%]="uploadProgress"></div>
        </div>
      </div>
      
      <!-- Upload Result -->
      <div *ngIf="uploadResult" class="mt-4 p-4 rounded-md" 
           [class.bg-green-50]="!uploadError" 
           [class.bg-red-50]="uploadError"
           data-testid="upload-result">
        <div *ngIf="!uploadError" class="text-green-800">
          <h4 class="font-medium">Upload réussi !</h4>
          <div class="mt-2 text-sm space-y-1">
            <p><strong>Document:</strong> {{ uploadResult.document.title }}</p>
            <p><strong>Chunks:</strong> {{ uploadResult.stats.chunks }}</p>
            <p *ngIf="uploadResult.stats.pages"><strong>Pages:</strong> {{ uploadResult.stats.pages }}</p>
            <p><strong>Temps d'embedding:</strong> {{ uploadResult.stats.embed_ms_total }}ms</p>
            <p *ngIf="uploadResult.stats.duplicate" class="text-orange-600">⚠️ Document déjà existant</p>
          </div>
        </div>
        
        <div *ngIf="uploadError" class="text-red-800">
          <h4 class="font-medium">Erreur d'upload</h4>
          <p class="mt-1 text-sm">{{ uploadError }}</p>
        </div>
      </div>
      
      <!-- Error Messages -->
      <div *ngIf="validationError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" data-testid="validation-error">
        <p class="text-red-800 text-sm">{{ validationError }}</p>
      </div>
    </div>
  `,
  styles: [`
    .drag-over {
      border-color: #3b82f6;
      background-color: #eff6ff;
    }
  `]
})
export class UploadComponent {
  @Output() uploadComplete = new EventEmitter<UploadResult>();

  selectedFile: File | null = null;
  isUploading = false;
  uploadProgress = 0;
  uploadStatus = '';
  uploadResult: UploadResult | null = null;
  uploadError: string | null = null;
  validationError: string | null = null;
  isDragOver = false;

  readonly maxSizeMb = environment.maxUploadMb;
  readonly acceptedTypes = environment.allowedMimeTypes.join(',');

  constructor(private ingestService: IngestService) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  private handleFileSelection(file: File): void {
    this.clearMessages();
    
    // Validation
    if (!this.validateFile(file)) {
      return;
    }
    
    this.selectedFile = file;
  }

  private validateFile(file: File): boolean {
    // Vérifier le type MIME
    if (!environment.allowedMimeTypes.includes(file.type)) {
      this.validationError = `Type de fichier non supporté: ${file.type}`;
      return false;
    }
    
    // Vérifier la taille
    const maxSizeBytes = this.maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      this.validationError = `Fichier trop volumineux. Taille maximum: ${this.maxSizeMb}MB`;
      return false;
    }
    
    return true;
  }

  uploadFile(): void {
    if (!this.selectedFile) return;
    
    this.isUploading = true;
    this.uploadProgress = 0;
    this.uploadStatus = 'Extraction du texte...';
    this.clearMessages();
    
    // Simulation de progression
    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) {
        this.uploadProgress += Math.random() * 10;
        if (this.uploadProgress > 30 && this.uploadProgress < 60) {
          this.uploadStatus = 'Chunking et normalisation...';
        } else if (this.uploadProgress > 60) {
          this.uploadStatus = 'Génération des embeddings...';
        }
      }
    }, 200);
    
    this.ingestService.uploadDocument(this.selectedFile).subscribe({
      next: (result) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.uploadStatus = 'Terminé !';
        this.uploadResult = result;
        this.isUploading = false;
        this.selectedFile = null;
        this.uploadComplete.emit(result);
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadError = error.error?.error || 'Erreur lors de l\'upload';
        console.error('Upload error:', error);
      }
    });
  }

  clearSelection(): void {
    this.selectedFile = null;
    this.clearMessages();
  }

  private clearMessages(): void {
    this.uploadResult = null;
    this.uploadError = null;
    this.validationError = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

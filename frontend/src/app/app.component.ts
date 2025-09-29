import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Source {
  source_id: string;
  filename: string;
  size: number;
  uploaded_at: string;
  processing_status?: string;
}

interface ChatMessage {
  message: string;
  answer: string;
  timestamp: string;
  source_filename?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Regalica Notebook JS';
  
  // État des panneaux
  sources: Source[] = [];
  chatMessages: ChatMessage[] = [];
  selectedSource: Source | null = null;
  
  // Formulaires
  uploadFile: File | null = null;
  chatMessage: string = '';
  
  // États UI
  isUploading = false;
  isChatting = false;
  uploadError: string = '';
  chatError: string = '';
  
  private readonly API_BASE = 'http://localhost:8080';

  constructor(private http: HttpClient) {
    this.loadSources();
  }

  // === GESTION DES SOURCES ===
  
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.uploadFile = file;
      this.uploadError = '';
    } else {
      this.uploadError = 'Veuillez sélectionner un fichier PDF';
      this.uploadFile = null;
    }
  }

  async uploadSource(): Promise<void> {
    if (!this.uploadFile) {
      this.uploadError = 'Aucun fichier sélectionné';
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    try {
      const formData = new FormData();
      formData.append('file', this.uploadFile);

      const response = await this.http.post<any>(`${this.API_BASE}/sources`, formData).toPromise();
      
      console.log('Upload successful:', response);
      
      // Recharger la liste des sources
      await this.loadSources();
      
      // Réinitialiser le formulaire
      this.uploadFile = null;
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error('Upload error:', error);
      this.uploadError = error.error?.error || 'Erreur lors de l\'upload';
    } finally {
      this.isUploading = false;
    }
  }

  async loadSources(): Promise<void> {
    try {
      const response = await this.http.get<{sources: Source[]}>(`${this.API_BASE}/sources`).toPromise();
      this.sources = response?.sources || [];
    } catch (error) {
      console.error('Error loading sources:', error);
      this.sources = [];
    }
  }

  selectSource(source: Source): void {
    this.selectedSource = source;
    this.chatMessages = []; // Réinitialiser le chat pour la nouvelle source
    this.chatError = '';
  }

  // === GESTION DU CHAT ===

  async sendChatMessage(): Promise<void> {
    if (!this.chatMessage.trim() || !this.selectedSource) {
      this.chatError = 'Veuillez sélectionner une source et saisir un message';
      return;
    }

    this.isChatting = true;
    this.chatError = '';

    try {
      const payload = {
        message: this.chatMessage.trim(),
        source_id: this.selectedSource.source_id
      };

      const response = await this.http.post<any>(`${this.API_BASE}/chat/ask`, payload).toPromise();
      
      // Ajouter le message au chat
      this.chatMessages.push({
        message: this.chatMessage.trim(),
        answer: response.answer,
        timestamp: response.timestamp,
        source_filename: response.source_filename
      });

      // Réinitialiser le champ de message
      this.chatMessage = '';
      
    } catch (error: any) {
      console.error('Chat error:', error);
      this.chatError = error.error?.error || 'Erreur lors de l\'envoi du message';
    } finally {
      this.isChatting = false;
    }
  }

  onChatKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  // === UTILITAIRES ===

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }
}

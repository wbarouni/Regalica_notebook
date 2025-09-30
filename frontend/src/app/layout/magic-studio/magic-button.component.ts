import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-magic-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="magic-button" 
            (click)="toggleMagicStudio()"
            title="Magic Studio">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
      </svg>
      <span>Magic</span>
    </button>
  `,
  styles: [`
    .magic-button {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #111827;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 2rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
    }
    
    .magic-button:hover {
      background: #374151;
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }
    
    .magic-button:active {
      transform: translateY(0);
    }
  `]
})
export class MagicButtonComponent {
  toggleMagicStudio(): void {

  }
}

import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { NotebookManagerComponent } from './notebooks/notebook-manager/notebook-manager.component';
import { NotebookResolver } from './notebooks/notebook.resolver';

export const routes: Routes = [
  { 
    path: 'notebooks', 
    component: NotebookManagerComponent 
  },
  {
    path: 'notebooks/:id',
    component: ShellComponent,
    resolve: { boot: NotebookResolver }
  },
  { 
    path: '', 
    redirectTo: '/notebooks',
    pathMatch: 'full'
  }
];

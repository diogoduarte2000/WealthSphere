import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../services/forum.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forum',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forum.component.html',
  styleUrl: './forum.component.css'
})
export class ForumComponent implements OnInit {
  private forumService = inject(ForumService);

  posts: any[] = [];
  activeCategory: string = 'Todas';
  showCreateModal: boolean = false;

  newPost = {
    title: '',
    content: '',
    category: 'Discussão',
    game: 'CS2',
    price: null
  };

  ngOnInit() {
    this.loadPosts();
  }

  loadPosts() {
    this.forumService.getPosts().subscribe({
      next: (res) => {
        this.posts = res;
      },
      error: (err) => console.error('Erro ao carregar posts:', err)
    });
  }

  createPost() {
    if (!this.newPost.title || !this.newPost.content) {
      alert('Por favor preenche o título e o conteúdo.');
      return;
    }

    this.forumService.createPost(this.newPost).subscribe({
      next: (res) => {
        this.loadPosts();
        this.closeModal();
        alert('Anúncio publicado com sucesso!');
      },
      error: (err) => {
        alert('Erro ao publicar: ' + (err.error?.message || 'Token expirado'));
      }
    });
  }

  deletePost(id: string) {
    if (confirm('Tens a certeza que queres remover este anúncio?')) {
      this.forumService.deletePost(id).subscribe({
        next: () => this.loadPosts(),
        error: (err) => alert(err.error?.message || 'Erro ao apagar')
      });
    }
  }

  filterByCategory(cat: string) {
    this.activeCategory = cat;
  }

  getFilteredPosts() {
    if (this.activeCategory === 'Todas') return this.posts;
    return this.posts.filter(p => p.category === this.activeCategory);
  }

  getRemainingDays(expiresAt: string): number {
    const remaining = new Date(expiresAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
  }

  openModal() { this.showCreateModal = true; }
  closeModal() { 
    this.showCreateModal = false;
    this.newPost = { title: '', content: '', category: 'Discussão', game: 'CS2', price: null };
  }

  getUserID(): string {
    const token = localStorage.getItem('wealthsphere_access_token');
    if (!token) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch { return ''; }
  }
}

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
  activeSort: string = 'trending';
  searchQuery: string = '';
  showCreateModal: boolean = false;
  activePostId: string | null = null;
  expandedPost: any = null;

  newPost = {
    title: '',
    content: '',
    category: 'Novato',
    tagsString: ''
  };

  newCommentText: string = '';
  replyingCommentId: string | null = null;
  newReplyText: string = '';

  // Online users mockup
  onlineUsers = [
    { name: 'miguel.f', initial: 'M', color: '#c96a45' },
    { name: 'pedro.inv', initial: 'P', color: '#5f8c5f' },
    { name: 'afx_trade', initial: 'A', color: '#8b80c8' },
    { name: 'carla.m', initial: 'C', color: '#c9a84c' },
    { name: 'rui.s', initial: 'R', color: '#6a8fc9' },
    { name: 'sofia.p', initial: 'S', color: '#8f6ac9' }
  ];

  // Top reputed users mockup
  topUsers = [
    { name: 'miguel.f', score: 843, color: '#c96a45', flair: 'Expert ETFs', initial: 'M', online: true },
    { name: 'pedro.invest', score: 624, color: '#5f8c5f', flair: 'Landlord', initial: 'P', online: true },
    { name: 'rui.santos', score: 489, color: '#6a8fc9', flair: 'FIRE', initial: 'R', online: false },
    { name: 'afx_trade', score: 382, color: '#8b80c8', flair: 'Skin Trader', initial: 'A', online: true },
    { name: 'sofia.p', score: 184, color: '#8f6ac9', flair: 'Novata', initial: 'S', online: false }
  ];

  // Popular tags mockup
  popularTags = [
    { name: '#investimentos', count: 184 },
    { name: '#ETF', count: 89 },
    { name: '#imóveis', count: 61 },
    { name: '#cs2-skins', count: 44 },
    { name: '#FIRE', count: 38 },
    { name: '#portugal', count: 52 },
    { name: '#cripto', count: 29 }
  ];

  // Weekly trending mockup (top 5 posts)
  trendingPosts = [
    { id: '1', category: 'ETF', title: 'VWCE vs IWDA — qual escolher para DCA mensal em Portugal?', replies: 37, views: '1.2k' },
    { id: '2', category: 'CS2', title: 'AK-47 Redline subiu 18% em 30 dias — tendência ou bolha?', replies: 23, views: '618' },
    { id: '3', category: 'Imóveis', title: 'Rentabilidade líquida de imóvel em Lisboa depois de IRS — o meu cálculo', replies: 18, views: '840' },
    { id: '4', category: 'FIRE', title: 'Reforma antecipada aos 45 com €1.800/mês de despesas — plano', replies: 94, views: '3.4k' },
    { id: '5', category: 'Cripto', title: 'Bitcoin vs ETFs — faz sentido ter os dois na mesma carteira?', replies: 29, views: '912' }
  ];

  myProfile = {
    name: 'Diogo Duarte',
    initial: 'D',
    role: 'Membro · Lisboa',
    posts: 12,
    votes: 284,
    views: '4.2k'
  };

  ngOnInit() {
    this.loadPosts();
    this.loadMyProfileInfo();
  }

  loadMyProfileInfo() {
    const userStr = localStorage.getItem('wealthsphere_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.myProfile.name = user.displayName || user.name || 'Diogo Duarte';
        this.myProfile.initial = this.myProfile.name.charAt(0).toUpperCase();
        this.myProfile.role = 'Membro · Lisboa 🇵🇹';
      } catch (e) {
        console.error('Error loading profile in forum component:', e);
      }
    }
  }

  loadPosts() {
    const filters = {
      search: this.searchQuery,
      category: this.activeCategory !== 'Todas' ? this.activeCategory : undefined,
      sort: this.activeSort
    };

    this.forumService.getPosts(filters).subscribe({
      next: (res) => {
        const currentUserId = this.getUserID();
        this.posts = res.map(post => ({
          ...post,
          upvoted: post.upvotedBy?.some((id: string) => id === currentUserId),
          downvoted: post.downvotedBy?.some((id: string) => id === currentUserId)
        }));

        // If the expanded post is in the list, update it
        if (this.activePostId) {
          const updated = this.posts.find(p => p._id === this.activePostId);
          if (updated) {
            this.expandedPost = updated;
          }
        }
      },
      error: (err) => console.error('Erro ao carregar posts:', err)
    });
  }

  filterByCategory(cat: string) {
    this.activeCategory = cat;
    this.loadPosts();
  }

  filterByPopularTag(tagName: string) {
    // Search by popular tag
    this.searchQuery = tagName;
    this.loadPosts();
  }

  setSort(sortType: string) {
    this.activeSort = sortType;
    this.loadPosts();
  }

  onSearch() {
    this.loadPosts();
  }

  togglePost(postId: string, event?: Event) {
    // Avoid toggling if clicking inside interactive buttons
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('.vote-wrap') || target.closest('.action-btn') || target.closest('.post-tag')) {
        return;
      }
    }

    if (this.activePostId === postId) {
      this.activePostId = null;
      this.expandedPost = null;
    } else {
      this.activePostId = postId;
      this.loadPostDetail(postId);
    }
  }

  loadPostDetail(postId: string) {
    this.forumService.getPost(postId).subscribe({
      next: (res) => {
        const currentUserId = this.getUserID();
        this.expandedPost = {
          ...res,
          upvoted: res.upvotedBy?.some((id: string) => id === currentUserId),
          downvoted: res.downvotedBy?.some((id: string) => id === currentUserId),
          comments: (res.comments || []).map((c: any) => ({
            ...c,
            upvoted: c.upvotedBy?.some((id: string) => id === currentUserId),
            downvoted: c.downvotedBy?.some((id: string) => id === currentUserId)
          }))
        };
      },
      error: (err) => console.error('Erro ao carregar detalhes do post:', err)
    });
  }

  votePost(event: Event, postId: string, direction: 'up' | 'down') {
    event.stopPropagation();
    if (!this.getUserID()) {
      alert('Tens de estar autenticado para votar!');
      return;
    }

    this.forumService.votePost(postId, direction).subscribe({
      next: (res) => {
        const post = this.posts.find(p => p._id === postId);
        if (post) {
          post.votes = res.votes;
          post.upvoted = res.upvoted;
          post.downvoted = res.downvoted;
        }
        if (this.expandedPost && this.expandedPost._id === postId) {
          this.expandedPost.votes = res.votes;
          this.expandedPost.upvoted = res.upvoted;
          this.expandedPost.downvoted = res.downvoted;
        }
      },
      error: (err) => alert(err.error?.message || 'Erro ao votar')
    });
  }

  addComment() {
    if (!this.newCommentText.trim()) return;
    if (!this.getUserID()) {
      alert('Inicia sessão para comentar no fórum.');
      return;
    }

    const postId = this.expandedPost._id;
    this.forumService.addComment(postId, this.newCommentText).subscribe({
      next: (res) => {
        this.newCommentText = '';
        this.loadPostDetail(postId);
        // Refresh replies count in main list
        this.loadPosts();
      },
      error: (err) => alert(err.error?.message || 'Erro ao comentar')
    });
  }

  toggleReply(commentId: string) {
    this.replyingCommentId = this.replyingCommentId === commentId ? null : commentId;
    this.newReplyText = '';
  }

  addReply(commentId: string) {
    if (!this.newReplyText.trim()) return;
    if (!this.getUserID()) {
      alert('Inicia sessão para responder no fórum.');
      return;
    }

    const postId = this.expandedPost._id;
    this.forumService.addReply(postId, commentId, this.newReplyText).subscribe({
      next: (res) => {
        this.newReplyText = '';
        this.replyingCommentId = null;
        this.loadPostDetail(postId);
      },
      error: (err) => alert(err.error?.message || 'Erro ao responder')
    });
  }

  voteComment(commentId: string, direction: 'up' | 'down') {
    if (!this.getUserID()) {
      alert('Tens de estar autenticado para votar!');
      return;
    }

    this.forumService.voteComment(commentId, direction).subscribe({
      next: (res) => {
        if (this.expandedPost) {
          const comment = this.expandedPost.comments.find((c: any) => c._id === commentId);
          if (comment) {
            comment.votes = res.votes;
            const currentUserId = this.getUserID();
            comment.upvoted = direction === 'up' ? !comment.upvoted : false;
            comment.downvoted = direction === 'down' ? !comment.downvoted : false;
          }
        }
      },
      error: (err) => alert(err.error?.message || 'Erro ao votar')
    });
  }

  createPost() {
    if (!this.newPost.title || !this.newPost.content) {
      alert('Por favor preenche o título e o conteúdo.');
      return;
    }

    // Split tags by space or comma, filtering empty values
    const rawTags = this.newPost.tagsString
      .split(/[,\s]+/)
      .filter(t => t.trim().length > 0)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    const postData = {
      title: this.newPost.title,
      content: this.newPost.content,
      category: this.newPost.category,
      tags: rawTags
    };

    this.forumService.createPost(postData).subscribe({
      next: (res) => {
        this.loadPosts();
        this.closeModal();
        alert('Publicado com sucesso no fórum!');
      },
      error: (err) => {
        alert('Erro ao publicar: ' + (err.error?.message || 'Inicia sessão para publicar'));
      }
    });
  }

  deletePost(id: string) {
    if (confirm('Tens a certeza que queres remover este post?')) {
      this.forumService.deletePost(id).subscribe({
        next: () => {
          if (this.activePostId === id) {
            this.activePostId = null;
            this.expandedPost = null;
          }
          this.loadPosts();
        },
        error: (err) => alert(err.error?.message || 'Erro ao apagar')
      });
    }
  }

  openModal() { this.showCreateModal = true; }
  closeModal() { 
    this.showCreateModal = false;
    this.newPost = { title: '', content: '', category: 'Novato', tagsString: '' };
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

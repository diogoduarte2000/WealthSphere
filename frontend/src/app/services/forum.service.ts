import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/forum`;

  private getHeaders() {
    const token = localStorage.getItem('wealthsphere_access_token');
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getPosts(filters?: { search?: string; category?: string; tag?: string; sort?: string }): Observable<any[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.category) params = params.set('category', filters.category);
      if (filters.tag) params = params.set('tag', filters.tag);
      if (filters.sort) params = params.set('sort', filters.sort);
    }
    return this.http.get<any[]>(this.apiUrl, { params });
  }

  getPost(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createPost(post: any): Observable<any> {
    return this.http.post(this.apiUrl, post, { headers: this.getHeaders() });
  }

  deletePost(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  votePost(id: string, direction: 'up' | 'down'): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/vote`, { direction }, { headers: this.getHeaders() });
  }

  addComment(postId: string, content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${postId}/comments`, { content }, { headers: this.getHeaders() });
  }

  addReply(postId: string, commentId: string, content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${postId}/comments/${commentId}/reply`, { content }, { headers: this.getHeaders() });
  }

  voteComment(commentId: string, direction: 'up' | 'down'): Observable<any> {
    return this.http.post(`${this.apiUrl}/comments/${commentId}/vote`, { direction }, { headers: this.getHeaders() });
  }
}

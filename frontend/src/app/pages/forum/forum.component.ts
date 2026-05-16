import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemoService } from '../../services/demo.service';

@Component({
  selector: 'app-forum',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forum.component.html',
  styleUrl: './forum.component.css'
})
export class ForumComponent implements OnInit {
  posts: any[] = [];
  selectedPost: any = null;
  comments: any[] = [];
  activeTag: string = '';

  constructor(private demoService: DemoService) {}

  ngOnInit() {
    this.loadPosts();
  }

  loadPosts() {
    this.posts = this.demoService.getForumPosts();
  }

  selectPost(post: any) {
    this.selectedPost = post;
    this.comments = this.demoService.getComments(post.id);
  }

  filterByTag(tag: string) {
    this.activeTag = this.activeTag === tag ? '' : tag;
    if (this.activeTag) {
      this.posts = this.demoService.getForumPosts().filter(post => 
        post.tags.includes(this.activeTag)
      );
    } else {
      this.loadPosts();
    }
  }

  upvotePost(post: any) {
    post.upvotes++;
  }

  downvotePost(post: any) {
    post.downvotes++;
  }

  upvoteComment(comment: any) {
    comment.upvotes++;
  }

  downvoteComment(comment: any) {
    comment.downvotes++;
  }

  backToPosts() {
    this.selectedPost = null;
    this.comments = [];
  }

  getAllTags(): string[] {
    const allTags = this.demoService.getForumPosts().flatMap(post => post.tags);
    return [...new Set(allTags)];
  }
}

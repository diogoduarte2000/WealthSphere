import { Injectable } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnimationsService {
  private pageReadySubject = new BehaviorSubject<boolean>(false);
  public pageReady$ = this.pageReadySubject.asObservable();

  private animationStateSubject = new BehaviorSubject<Map<string, boolean>>(new Map());
  public animationState$ = this.animationStateSubject.asObservable();

  constructor() {}

  /**
   * Signal that the page is ready and animations can start
   */
  pageReady(): void {
    this.pageReadySubject.next(true);
    setTimeout(() => this.pageReadySubject.next(false), 100);
  }

  /**
   * Trigger animation for a specific element by ID
   */
  triggerAnimation(elementId: string): void {
    const state = this.animationStateSubject.value;
    state.set(elementId, true);
    this.animationStateSubject.next(new Map(state));
  }

  /**
   * Trigger staggered animations for multiple elements
   */
  triggerStaggeredAnimations(elementIds: string[], delayBetween: number = 50): void {
    elementIds.forEach((id, index) => {
      setTimeout(() => {
        this.triggerAnimation(id);
      }, index * delayBetween);
    });
  }

  /**
   * Reset all animations
   */
  resetAnimations(): void {
    this.animationStateSubject.next(new Map());
  }

  /**
   * Get animation state for a specific element
   */
  getAnimationState(elementId: string): Observable<boolean> {
    return new Observable(observer => {
      this.animationState$.subscribe(state => {
        observer.next(state.get(elementId) || false);
      });
    });
  }
}

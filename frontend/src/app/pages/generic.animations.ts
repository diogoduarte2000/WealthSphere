import { trigger, state, style, animate, transition } from '@angular/animations';

/**
 * Generic page animations
 * Reusable animations for all other pages (forum, settings, income, etc)
 */
export const genericPageAnimations = {
  // Basic fade in
  fadeInAnimation: trigger('fadeIn', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('0.3s ease-out', style({ opacity: 1 }))
    ])
  ]),

  // List item stagger animation
  listItemStaggerAnimation: trigger('listItemStagger', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' }),
      animate('0.4s {{delay}}ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Card appear animation
  cardAppearAnimation: trigger('cardAppear', [
    transition(':enter', [
      style({ opacity: 0, transform: 'scale(0.95)' }),
      animate('0.3s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
    ])
  ]),

  // Header animation
  headerAnimation: trigger('header', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(-10px)' }),
      animate('0.4s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Content expand animation
  expandAnimation: trigger('expand', [
    state('collapsed', style({ height: '0', opacity: 0, overflow: 'hidden' })),
    state('expanded', style({ height: '*', opacity: 1 })),
    transition('collapsed <=> expanded', animate('0.3s ease-out'))
  ]),

  // Bounce animation
  bounceAnimation: trigger('bounce', [
    transition('* => bounce', [
      animate('0.1s ease-out', style({ transform: 'translateY(-5px)' })),
      animate('0.1s ease-in', style({ transform: 'translateY(0)' }))
    ])
  ]),

  // Highlight animation
  highlightAnimation: trigger('highlight', [
    state('normal', style({ backgroundColor: 'transparent' })),
    state('highlighted', style({ backgroundColor: 'rgba(201, 106, 69, 0.1)' })),
    transition('normal <=> highlighted', animate('0.3s ease-out'))
  ])
};

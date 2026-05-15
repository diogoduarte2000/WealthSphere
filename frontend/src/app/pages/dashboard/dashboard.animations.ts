import { trigger, state, style, animate, transition } from '@angular/animations';

/**
 * Dashboard page animations
 * Optimized animations that trigger on-demand to prevent render stuttering
 */
export const dashboardAnimations = {
  // Fade up animation for content cards
  fadeUpAnimation: trigger('fadeUp', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(16px)' }),
      animate('0.5s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Staggered fade up with configurable delay
  staggerFadeUpAnimation: trigger('staggerFadeUp', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(16px)' }),
      animate('0.5s {{delay}}ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Modal animations
  modalAnimation: trigger('modal', [
    transition(':enter', [
      style({ opacity: 0, transform: 'scale(0.95)' }),
      animate('0.25s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
    ]),
    transition(':leave', [
      animate('0.25s ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
    ])
  ]),

  // Sidebar slide animation
  sidebarAnimation: trigger('sidebar', [
    transition(':enter', [
      style({ transform: 'translateX(-100%)' }),
      animate('0.3s ease-out', style({ transform: 'translateX(0)' }))
    ]),
    transition(':leave', [
      animate('0.3s ease-in', style({ transform: 'translateX(-100%)' }))
    ])
  ]),

  // Card hover animation
  cardHoverAnimation: trigger('cardHover', [
    state('normal', style({ transform: 'translateY(0)', boxShadow: 'none' })),
    state('hovered', style({ transform: 'translateY(-6px)', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' })),
    transition('normal <=> hovered', animate('0.3s ease-out'))
  ]),

  // Blink animation for status indicator
  blinkAnimation: trigger('blink', [
    state('active', style({ opacity: 1 })),
    transition('* => active', [
      animate('2s ease-in-out', style({ opacity: 0.4 })),
      animate('2s ease-in-out', style({ opacity: 1 }))
    ])
  ]),

  // Tooltip fade animation
  tooltipAnimation: trigger('tooltip', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(-5px)' }),
      animate('0.2s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ]),
    transition(':leave', [
      animate('0.2s ease-in', style({ opacity: 0, transform: 'translateY(-5px)' }))
    ])
  ])
};

import { trigger, state, style, animate, transition } from '@angular/animations';

/**
 * Landing page animations
 * These animations are defined here and triggered on demand to prevent stuttering
 */
export const landingAnimations = {
  // Fade up animation with stagger
  fadeUpAnimation: trigger('fadeUp', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(24px)' }),
      animate('0.7s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Staggered fade up for multiple elements
  staggerAnimation: trigger('stagger', [
    state('ready', style({ opacity: 1, transform: 'translateY(0)' })),
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(24px)' }),
      animate('0.7s {{delay}}ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ])
  ]),

  // Pulse animation for indicators
  pulseAnimation: trigger('pulse', [
    state('active', style({ opacity: 1 })),
    transition('* => active', [
      animate('2s ease-in-out', style({ opacity: 0.4 })),
      animate('2s ease-in-out', style({ opacity: 1 }))
    ])
  ]),

  // Slide in animation
  slideInAnimation: trigger('slideIn', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateX(-20px)' }),
      animate('0.5s ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
    ])
  ]),

  // Fade in animation
  fadeInAnimation: trigger('fadeIn', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('0.4s ease-out', style({ opacity: 1 }))
    ])
  ]),

  // Scale animation
  scaleAnimation: trigger('scale', [
    transition(':enter', [
      style({ opacity: 0, transform: 'scale(0.9)' }),
      animate('0.5s ease-out', style({ opacity: 1, transform: 'scale(1)' }))
    ])
  ])
};

import { animate, style, transition, trigger } from '@angular/animations';

export const pageAnimations = [
  trigger('pageTransition', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(10px)' }),
      animate(
        '300ms ease-out',
        style({ opacity: 1, transform: 'translateY(0)' })
      )
    ]),
    transition(':leave', [
      style({ opacity: 1, transform: 'translateY(0)' }),
      animate(
        '200ms ease-in',
        style({ opacity: 0, transform: 'translateY(-10px)' })
      )
    ])
  ])
];

export const fadeInAnimation = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 }))
  ])
]);

export const slideInAnimation = trigger('slideIn', [
  transition(':enter', [
    style({ transform: 'translateX(-20px)', opacity: 0 }),
    animate('250ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
  ])
]);

export const scaleInAnimation = trigger('scaleIn', [
  transition(':enter', [
    style({ transform: 'scale(0.9)', opacity: 0 }),
    animate('200ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
  ])
]);

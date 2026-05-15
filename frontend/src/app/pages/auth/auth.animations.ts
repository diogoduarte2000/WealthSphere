import { trigger, state, style, animate, transition } from '@angular/animations';

/**
 * Auth page animations
 * Smooth animations for login/register pages
 */
export const authAnimations = {
  // Form slide animation
  formSlideAnimation: trigger('formSlide', [
    transition(':enter', [
      style({ opacity: 0.72, transform: 'translateX(18px)', filter: 'blur(4px)' }),
      animate('0.5s ease-out', style({ opacity: 1, transform: 'translateX(0)', filter: 'blur(0)' }))
    ])
  ]),

  // Liquid morph animation for background
  liquidMorphAnimation: trigger('liquidMorph', [
    transition(':enter', [
      animate('0.6s ease-in-out', style({ transform: 'scale(1.015, 0.985)', filter: 'saturate(1.25)' })),
      animate('0.4s ease-in-out', style({ transform: 'scale(1)', filter: 'saturate(1)' }))
    ])
  ]),

  // Tab switch animation
  tabSwitchAnimation: trigger('tabSwitch', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateX(20px)' }),
      animate('0.3s ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
    ]),
    transition(':leave', [
      animate('0.3s ease-in', style({ opacity: 0, transform: 'translateX(-20px)' }))
    ])
  ]),

  // Error shake animation
  errorShakeAnimation: trigger('shake', [
    transition('* => error', [
      animate('0.1s ease-in', style({ transform: 'translateX(-10px)' })),
      animate('0.1s ease-out', style({ transform: 'translateX(10px)' })),
      animate('0.1s ease-in', style({ transform: 'translateX(-10px)' })),
      animate('0.1s ease-out', style({ transform: 'translateX(0)' }))
    ])
  ]),

  // Button press animation
  buttonPressAnimation: trigger('buttonPress', [
    state('idle', style({ transform: 'scale(1)' })),
    state('pressed', style({ transform: 'scale(0.98)' })),
    transition('idle <=> pressed', animate('0.1s ease-out'))
  ]),

  // Input focus animation
  inputFocusAnimation: trigger('inputFocus', [
    state('focused', style({ boxShadow: '0 0 0 3px rgba(201, 106, 69, 0.1)' })),
    transition('* => focused', animate('0.2s ease-out')),
    transition('focused => *', animate('0.2s ease-out', style({ boxShadow: 'none' })))
  ])
};

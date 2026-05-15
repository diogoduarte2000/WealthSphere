# Animation System Documentation

This folder contains Angular animation configurations for the WealthSphere application. These animations are optimized to prevent rendering stuttering on page entry.

## Files

- **animations.service.ts** - Central service for animation state management
- **landing.animations.ts** - Landing page animations
- **dashboard.animations.ts** - Dashboard page animations
- **auth.animations.ts** - Authentication page animations
- **generic.animations.ts** - Reusable animations for other pages

## How to Use

### 1. Import animations in your component

```typescript
import { dashboardAnimations } from './dashboard.animations';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  animations: [
    dashboardAnimations.fadeUpAnimation,
    dashboardAnimations.staggerFadeUpAnimation,
    dashboardAnimations.modalAnimation
  ]
})
export class DashboardComponent implements OnInit {
  // ...
}
```

### 2. Use animations in your template

#### Simple animation on enter:
```html
<div @fadeUpAnimation>
  This element will fade in when it enters the DOM
</div>
```

#### Staggered animation with delay:
```html
<div *ngFor="let item of items; let i = index"
     @staggerFadeUpAnimation
     [@staggerFadeUpAnimation]="{ value: 'in', params: { delay: i * 100 } }">
  {{ item.name }}
</div>
```

#### Conditional animation states:
```html
<div [@modal]="isOpen ? 'open' : 'closed'">
  Modal content
</div>
```

### 3. Trigger animations from the service

```typescript
import { AnimationsService } from '@app/services/animations.service';

export class MyComponent implements OnInit {
  constructor(private animationService: AnimationsService) {}

  ngOnInit() {
    // Signal when page is ready for animations
    this.animationService.pageReady();
    
    // Trigger specific element animations
    this.animationService.triggerAnimation('element-id');
    
    // Trigger multiple animations with stagger
    this.animationService.triggerStaggeredAnimations(
      ['card-1', 'card-2', 'card-3'],
      100 // delay between each animation in ms
    );
  }
}
```

## Performance Tips

1. **Lazy trigger animations** - Don't start all animations on page load; use the service to trigger them as needed
2. **Avoid animation on large lists** - For lists with many items, consider disabling animations for better performance
3. **Use hardware acceleration** - Stick to `transform` and `opacity` properties for best performance
4. **Respect prefers-reduced-motion** - CSS already handles this in the stylesheets

## Animation Performance

These animations use:
- CSS transforms (translateY, translateX, scale) for hardware acceleration
- Opacity for fade effects
- Reasonable durations (200-700ms) to prevent sluggish UI

## Customization

To add new animations:

1. Create a new animation file following the naming pattern: `[page-name].animations.ts`
2. Use Angular's `trigger()`, `state()`, `style()`, `animate()`, and `transition()` functions
3. Keep animations performant by using transforms and opacity
4. Document the animation purpose in comments

## Browser Support

These animations use Angular Animations, which requires:
- Angular 17.3.0+
- Modern browser with animation support (all major browsers)

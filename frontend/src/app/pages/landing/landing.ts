import { AfterViewInit, Component, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private observer?: IntersectionObserver;
  private tagCleanups: Array<() => void> = [];
  private motionCleanups: Array<() => void> = [];
  private parallaxItems: HTMLElement[] = [];
  private mouseX = 0;
  private mouseY = 0;
  private scrollY = 0;
  private animationFrame = 0;

  ngAfterViewInit(): void {
    const root = this.elementRef.nativeElement as HTMLElement;
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    this.parallaxItems = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('visible');
        this.observer?.unobserve(entry.target);
      });
    }, { threshold: 0.1 });

    reveals.forEach((item) => this.observer?.observe(item));

    root.querySelectorAll<HTMLElement>('.cloud-tag').forEach((tag) => {
      const cleanup = this.renderer.listen(tag, 'click', () => {
        root.querySelectorAll('.cloud-tag').forEach((item) => item.classList.remove('active'));
        tag.classList.add('active');
      });

      this.tagCleanups.push(cleanup);
    });

    this.motionCleanups.push(
      this.renderer.listen('window', 'scroll', () => {
        this.scrollY = window.scrollY;
        this.scheduleParallax();
      }),
      this.renderer.listen('window', 'mousemove', (event: MouseEvent) => {
        this.mouseX = event.clientX / window.innerWidth - 0.5;
        this.mouseY = event.clientY / window.innerHeight - 0.5;
        this.scheduleParallax();
      })
    );

    this.scheduleParallax();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.tagCleanups.forEach((cleanup) => cleanup());
    this.motionCleanups.forEach((cleanup) => cleanup());
    cancelAnimationFrame(this.animationFrame);
  }

  private scheduleParallax(): void {
    if (this.animationFrame) {
      return;
    }

    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.parallaxItems.forEach((item) => {
        const depth = Number(item.dataset['parallax'] ?? 0);
        const y = this.scrollY * depth * -0.12 + this.mouseY * depth * 60;
        const x = this.mouseX * depth * 70;
        this.renderer.setStyle(item, 'transform', `translate3d(${x}px, ${y}px, 0)`);
      });
    });
  }
}

import { Directive, ElementRef, inject, input, output, effect, OnInit, OnDestroy } from '@angular/core';

/**
 * Pull-to-refresh для скролл-контейнера. Вешается на элемент с overflow-y-auto.
 *
 *   <main bdPullToRefresh [bdPullToRefresh]="loading()" (refresh)="reload()">
 *
 * Жест ловится только когда контейнер прокручен в самый верх и палец тянет вниз.
 * Индикатор — это первый дочерний блок нулевой высоты, который растёт при протяжке
 * и толкает контент вниз (нативное ощущение). По достижении порога эмитит `refresh`;
 * родитель ставит `loading=true`, по завершении — `false`, и спиннер уезжает.
 */
@Directive({
  selector: '[bdPullToRefresh]',
  standalone: true,
})
export class PullToRefreshDirective implements OnInit, OnDestroy {
  /** Идёт ли обновление (крутить спиннер). */
  readonly loading = input(false, { alias: 'bdPullToRefresh' });
  /** Порог пройден, палец отпущен — пора грузить. */
  readonly refresh = output<void>();

  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private bar!: HTMLElement;
  private spinner!: HTMLElement;

  private startY = 0;
  private pulled = 0;
  private dragging = false;

  private readonly THRESHOLD = 64;   // px: дальше — запустить обновление
  private readonly MAX = 92;         // px: предел растяжения
  private readonly RESIST = 0.5;     // сопротивление протяжке

  constructor() {
    // Спиннер ведём от сигнала loading: пришёл true — крутим, ушёл — прячем.
    effect(() => {
      if (!this.bar) return;
      if (this.loading()) this.snap();
      else if (!this.dragging) this.retract();
    });
  }

  ngOnInit() {
    this.build();
    this.host.addEventListener('touchstart', this.onStart, { passive: true });
    this.host.addEventListener('touchmove', this.onMove, { passive: false });
    this.host.addEventListener('touchend', this.onEnd, { passive: true });
    this.host.addEventListener('touchcancel', this.onEnd, { passive: true });
  }

  ngOnDestroy() {
    this.host.removeEventListener('touchstart', this.onStart);
    this.host.removeEventListener('touchmove', this.onMove);
    this.host.removeEventListener('touchend', this.onEnd);
    this.host.removeEventListener('touchcancel', this.onEnd);
  }

  /** Индикатор: растягиваемая полоса с круговым спиннером по центру. */
  private build() {
    this.bar = document.createElement('div');
    this.bar.style.cssText =
      'height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;will-change:height';
    this.spinner = document.createElement('div');
    this.spinner.className = 'ptr-spinner';
    this.spinner.style.cssText =
      'width:22px;height:22px;border:2.5px solid var(--color-border);' +
      'border-top-color:var(--color-gold);border-radius:50%;opacity:0';
    this.bar.appendChild(this.spinner);
    this.host.insertBefore(this.bar, this.host.firstChild);
  }

  private onStart = (e: TouchEvent) => {
    this.startY = e.touches[0].clientY;
    this.dragging = false;
  };

  private onMove = (e: TouchEvent) => {
    if (this.loading()) return;
    const y = e.touches[0].clientY;
    if (!this.dragging) {
      // активируем жест только если тянут вниз от самого верха
      if (y - this.startY > 0 && this.host.scrollTop <= 0) {
        this.dragging = true;
        this.startY = y;
        this.bar.style.transition = 'none';
      } else return;
    }
    this.pulled = Math.min(this.MAX, Math.max(0, y - this.startY) * this.RESIST);
    this.bar.style.height = this.pulled + 'px';
    this.spinner.style.opacity = String(Math.min(1, this.pulled / this.THRESHOLD));
    this.spinner.style.transform = `rotate(${(this.pulled / this.MAX) * 270}deg)`;
    if (this.pulled > 2) e.preventDefault();   // глушим нативный rubber-band
  };

  private onEnd = () => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.pulled >= this.THRESHOLD) {
      this.snap();                 // оптимистично, без мигания
      this.refresh.emit();
      // нет обработчика → loading так и не станет true → откатываем
      setTimeout(() => { if (!this.loading()) this.retract(); }, 60);
    } else {
      this.retract();
    }
    this.pulled = 0;
  };

  /** Зафиксировать на пороге и крутить. */
  private snap() {
    this.bar.style.transition = 'height .25s ease';
    this.bar.style.height = this.THRESHOLD + 'px';
    this.spinner.style.opacity = '1';
    this.spinner.style.transform = '';
    this.spinner.classList.add('ptr-spinning');
  }

  /** Убрать индикатор. */
  private retract() {
    this.bar.style.transition = 'height .25s ease';
    this.bar.style.height = '0px';
    this.spinner.classList.remove('ptr-spinning');
  }
}
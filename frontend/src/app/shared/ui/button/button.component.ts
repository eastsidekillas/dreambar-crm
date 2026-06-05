import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

type Variant = 'fill' | 'outline' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'bd-button, button[bdBtn], a[bdBtn]',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content />`,
  host: { '[attr.disabled]': 'disabled || null' }
})
export class BdButtonComponent {
  @Input() variant: Variant = 'fill';
  @Input() size: Size = 'md';
  @Input() disabled = false;
  @Input() full = false;

  @HostBinding('style.opacity') get opacity() { return this.disabled ? '0.45' : '1'; }
  @HostBinding('style.pointer-events') get pe() { return this.disabled ? 'none' : 'auto'; }
  @HostBinding('style.cursor') get cursor() { return this.disabled ? 'not-allowed' : 'pointer'; }
  @HostBinding('style.display') get display() { return this.full ? 'block' : 'inline-flex'; }
  @HostBinding('style.width') get width() { return this.full ? '100%' : 'auto'; }
  @HostBinding('style.justify-content') get justify() { return 'center'; }
  @HostBinding('style.align-items') get align() { return 'center'; }
  @HostBinding('style.gap') get gap() { return '6px'; }
  @HostBinding('style.font-family') get ff() { return "'Oswald', sans-serif"; }
  @HostBinding('style.font-weight') get fw() { return '500'; }
  @HostBinding('style.letter-spacing') get ls() { return '0.18em'; }
  @HostBinding('style.text-transform') get tt() { return 'uppercase'; }
  @HostBinding('style.border') get border() {
    return this.variant === 'ghost'
      ? 'none'
      : '1px solid #c6a063';
  }
  @HostBinding('style.background') get bg() {
    return this.variant === 'fill' ? '#c6a063'
         : this.variant === 'ghost' ? 'transparent'
         : 'transparent';
  }
  @HostBinding('style.color') get color() {
    return this.variant === 'fill' ? '#080706' : '#c6a063';
  }
  @HostBinding('style.font-size') get fs() {
    return this.size === 'sm' ? '0.6rem' : this.size === 'lg' ? '0.8rem' : '0.68rem';
  }
  @HostBinding('style.padding') get pad() {
    return this.size === 'sm' ? '6px 12px' : this.size === 'lg' ? '12px 24px' : '9px 18px';
  }
  @HostBinding('style.min-height') get mh() {
    return this.size === 'sm' ? '36px' : this.size === 'lg' ? '52px' : '44px';
  }
  @HostBinding('style.border-radius') get br() { return '2px'; }
  @HostBinding('style.transition') get tr() { return 'background 0.15s, color 0.15s, transform 0.1s'; }
  @HostBinding('style.text-decoration') get td() { return 'none'; }
  @HostBinding('style.white-space') get ws() { return 'nowrap'; }
}

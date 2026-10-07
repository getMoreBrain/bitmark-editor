import { Component, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { BitmarkTheme, SessionChange } from '@gmb/bitmark-editor';
import { BmPaneComponent, BmSessionComponent } from '@gmb/bitmark-editor-angular';

const INITIAL = '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, BmSessionComponent, BmPaneComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** The document, as a form control: bm-session is a ControlValueAccessor. */
  protected readonly content = new FormControl(INITIAL, { nonNullable: true });
  protected readonly value = toSignal(this.content.valueChanges, { initialValue: INITIAL });
  protected readonly status = signal('none yet');
  protected readonly theme = signal<Extract<BitmarkTheme, string>>('auto');

  constructor() {
    // bm-session sets the token colours and, with `applyMonacoTheme`
    // (app.config.ts), Monaco's theme. The page follows too: `auto` lets the
    // browser pick from the OS setting.
    effect(() => {
      const theme = this.theme();
      document.documentElement.style.colorScheme = theme === 'auto' ? 'light dark' : theme;
    });
  }

  protected onChange({ bitmark, source }: SessionChange): void {
    this.status.set(`${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`);
  }

  protected setTheme(value: string): void {
    this.theme.set(value as Extract<BitmarkTheme, string>);
  }

  protected reset(): void {
    this.content.setValue(INITIAL);
  }
}

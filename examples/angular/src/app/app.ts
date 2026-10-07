import { Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { SessionChange } from '@gmb/bitmark-editor';
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

  protected onChange({ bitmark, source }: SessionChange): void {
    this.status.set(`${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`);
  }

  protected reset(): void {
    this.content.setValue(INITIAL);
  }
}

import { LitElement, html, type PropertyValues } from 'lit';
import { customElement } from 'lit/decorators/custom-element.js';
import { queryAssignedNodes } from 'lit/decorators/query-assigned-nodes.js';
import { property } from 'lit/decorators/property.js';
import { classMap } from 'lit/directives/class-map.js';
import { InternalsController } from '@patternfly/pfe-core/controllers/internals-controller.js';
import { getRandomId } from '@patternfly/pfe-core/functions/random.js';


import styles from './pf-select-option.css';

/**
 * select custom event for listbox options
 * @fires select
 */
export class PfSelectOptionSelectEvent extends Event {
  constructor(public originalEvent?: Event) {
    super('select', { bubbles: true, composed: true });
  }
}

/**
 * focus custom event for listbox options
 * @fires focus
 */
export class PfSelectOptionFocusEvent extends Event {
  constructor(public originalEvent: Event) {
    super('focus', { bubbles: true, composed: true });
  }
}

/**
 * blur custom event for listbox options
 * @fires blur
 */
export class PfSelectOptionBlurEvent extends Event {
  constructor(public originalEvent: Event) {
    super('blur', { bubbles: true, composed: true });
  }
}

/**
 * Option within a listbox
 * @slot -
 *        option text
 * @slot icon
 *        optional icon
 * @slot description
 *        optional description
 */
@customElement('pf-select-option')
export class PfSelectOption extends LitElement {
  static readonly styles = [styles];

  /**
   * whether option is disabled
   */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * value of options
   */
  @property({ attribute: false, reflect: true, type: String }) value!: string;

  /**
   * whether option is selected
   */
  @property({ type: Boolean }) selected = false;

  /**
   * whether option is active deswcendant
   */
  @property({ type: Boolean }) active = false;


  @queryAssignedNodes({ slot: '', flatten: true }) private _slottedText!: Node[];

  #active = false;

  #internals = new InternalsController(this, {
    role: 'option'
  });

  /**
  * option's position amoun the other options
  */
  set posInSet(posInSet: string | null) {
    this.#internals.ariaPosInSet = `${Math.max(0, parseInt(posInSet || '0'))}`;
  }

  get posInSet() {
    return this.#internals.ariaPosInSet;
  }

  /**
  * total number of options
  */
  set setSize(setSize: string | null) {
    this.#internals.ariaSetSize = `${Math.max(0, parseInt(setSize || '0'))}`;
  }

  get setSize() {
    return this.#internals.ariaSetSize;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.id ||= getRandomId();
  }

  render() {
    const { disabled, active } = this;
    return html`
      <div id="outer" class="${classMap({ active, disabled })}">
        <input 
          type="checkbox" 
          aria-hidden="true" 
          ?checked=${this.selected}
          ?disabled=${this.disabled}>
        <slot name="icon"></slot>
        <span><slot name="create"></slot><slot></slot></span>
        <svg 
          ?hidden=${!this.selected}
          viewBox="0 0 512 512" 
          fill="currentColor" 
          aria-hidden="true">
          <path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path>
        </svg>
        <div id="description"><slot name="description"></slot></div>
      </div>
    `;
  }

  updated(changed: PropertyValues<this>) {
    if (changed.has('selected')) {
      this.#internals.ariaSelected = this.selected ? 'true' : 'false';
      this.dispatchEvent(new PfSelectOptionSelectEvent());
    }
    if (changed.has('disabled')) {
      this.#internals.ariaDisabled = String(!!this.disabled);
    }
  }

  /**
   * text content within option (used for filtering)
   */
  get optionText() {
    return this._slottedText.map(node => node.textContent).join('').trim();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pf-select-option': PfSelectOption;
  }
}

import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { InternalsController } from '@patternfly/pfe-core/controllers/internals-controller.js';
import { RovingTabindexController } from '@patternfly/pfe-core/controllers/roving-tabindex-controller.js';

/**
 * whether list items are arranged vertically or horizontally;
 * limits arrow keys based on orientation
 */
export type ListboxOrientation = '' | 'horizontal' | 'vertical';


/**
 * value of listbox
 */
export type ListboxValue = unknown | unknown[];

/**
 * filtering, multiselect, and orientation options for listbox
 */
export interface ListboxConfigOptions {
  caseSensitive?: boolean;
  disableFilter?: boolean;
  matchAnywhere?: boolean;
  multiSelectable?: boolean;
  orientation?: ListboxOrientation;
}

/**
 * properties for listbox option elements
 */
export interface ListboxOptionElement extends HTMLElement {
  value: unknown;
  selected?: boolean;
  posInSet?: number;
  setSize?: number;
}

/**
 * Implements roving tabindex, as described in WAI-ARIA practices, [Managing Focus Within
 * Components Using a Roving
 * tabindex](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex)
 */
export class ListboxController<
  ItemType extends HTMLElement = HTMLElement,
> implements ReactiveController {
  /**
   * filter options that start with a string (case-insensitive)
   */
  #filter = '';
  /**
   * whether `*` has been pressed to show all options
   */
  #showAllOptions = false;

  /**
   * whether filtering (if enabled) will be case-sensitive
   */
  #caseSensitive = false;

  /**
   * whether option filtering is disabled
   */
  #disableFilter = false;

  #internals: InternalsController;

  /** event listeners for host element */
  #listeners = {
    'keydown': this.#onOptionKeydown.bind(this),
    'keyup': this.#onOptionKeyup.bind(this),
    'optionfocus': this.#onOptionFocus.bind(this),
    'click': this.#onOptionClick.bind(this),
  };

  /**
   * whether filtering (if enabled) will look for filter match anywhere in option text
   * (by default it will only match if option starts with filter)
   */
  #matchAnywhere = false;

  /**
   * current active descendant when shift key is pressed
   */
  #shiftStartingItem: ListboxOptionElement | null = null;

  #tabindex: RovingTabindexController;

  /**
   * all options that will not be hidden by a filter
   * */
  #options: ListboxOptionElement[] = [];

  /**
   * whether or not focus should be updated after filtering
   */
  #updateFocus = false;

  /**
   * current active descendant in listbox
   */
  get activeItem() {
    const [active] = this.options.filter(option => option.getAttribute('id') === this.#internals.ariaActivedescendant);
    return active || this.#tabindex.firstItem;
  }

  /**
   * text for filtering options
   */
  set filter(filterText: string) {
    if (this.#filter !== filterText) {
      this.#filter = filterText;
      this.#onFilterChange();
    }
  }

  get filter() {
    return this.#filter;
  }

  /**
   * whether filtering is case sensitive
   */
  set caseSensitive(caseSensitive: boolean) {
    if (this.#caseSensitive !== caseSensitive) {
      this.#caseSensitive = caseSensitive;
      this.#onFilterChange();
    }
  }

  get caseSensitive() {
    return this.#caseSensitive;
  }

  /**
   * whether filtering is disabled;
   * default is filtering enabled
   */
  set disableFilter(disableFilter: boolean) {
    if (this.#disableFilter !== disableFilter) {
      this.#disableFilter = disableFilter;
      this.#onFilterChange();
    }
  }

  get disableFilter(): boolean {
    return !!this.#disableFilter;
  }

  /**
   * whether listbox is disabled
   */
  set disabled(disabled: boolean) {
    this.#internals.ariaDisabled = disabled ? 'true' : 'false';
  }

  get disabled(): boolean {
    return this.#internals.ariaDisabled === 'true';
  }

  /**
   * whether listbox is multiselectable;
   * default is single-select
   */
  set multiSelectable(multiSelectable: boolean) {
    this.#internals.ariaMultiSelectable = multiSelectable ? 'true' : 'false';
  }

  get multiSelectable(): boolean {
    return this.#internals.ariaMultiSelectable === 'true';
  }

  /**
   * whether filtering matches anywhere in option text;
   * default is only options starting with filter
  */
  set matchAnywhere(matchAnywhere: boolean) {
    if (this.#matchAnywhere !== matchAnywhere) {
      this.#matchAnywhere = matchAnywhere;
      this.#onFilterChange();
    }
  }

  get matchAnywhere() {
    return this.#matchAnywhere;
  }

  /**
   * listbox orientation;
   * default is vertical
   */
  set orientation(orientation: ListboxOrientation) {
    this.#internals.ariaOrientation = orientation;
  }

  get orientation(): ListboxOrientation {
    const orientation = this.#internals.ariaOrientation || '';
    return orientation as ListboxOrientation;
  }

  /**
   * array of listbox option elements
   */
  set options(options: ListboxOptionElement[]) {
    const setSize = options.length;
    if (setSize !== this.#options.length || !options.every((element, index) => element === this.#options[index])) {
      options.forEach((option, posInSet) => {
        option.setSize = setSize;
        option.posInSet = posInSet;
      });
      this.#options = options;
      this.#tabindex.initItems(this.visibleOptions);
    }
  }

  get options() {
    return this.#options;
  }

  /**
   * array of options which are selected
   */
  get selectedOptions() {
    return this.options.filter(option => option.selected);
  }

  /**
   * listbox value based on selected options
   */
  set value(optionsList: ListboxValue) {
    const oldValue = this.value;
    let firstItem: unknown;
    if (Array.isArray(optionsList)) {
      [firstItem] = optionsList || [null];
    } else {
      firstItem = optionsList;
    }
    this.options.forEach(option => {
      const selected = this.multiSelectable && Array.isArray(optionsList) ? optionsList?.includes(option.value) : firstItem === option;
      option.selected = selected;
    });
    if (oldValue !== this.value) {
      this.#fireInput();
    }
  }

  get value() {
    const [firstItem] = this.selectedOptions;
    return this.multiSelectable ? this.selectedOptions : firstItem;
  }

  /**
   * array of options that match filter;
   * (or all options if no options match or if no filter)
   */
  get visibleOptions() {
    let matchedOptions: ListboxOptionElement[] = [];
    if (!(this.disableFilter || this.filter === '*' || this.#showAllOptions)) {
      matchedOptions = this.options.filter(option => {
        const search = this.matchAnywhere ? '' : '^';
        const text = option.textContent || '';
        const regex = new RegExp(`${search}${this.filter}`, this.caseSensitive ? '' : 'i');
        if (this.filter === '' || text.match(regex)) {
          return true;
        } else {
          return false;
        }
      });
    }

    // ensure there is at least one option showing,
    // regardless of matches
    if (matchedOptions.length < 1) {
      matchedOptions = this.options;
    }
    this.options.forEach(option => {
      if (matchedOptions.includes(option)) {
        option.removeAttribute('hidden-by-filter');
      } else {
        if (document.activeElement === option) {
          this.#updateFocus = true;
        }
        option.setAttribute('hidden-by-filter', 'hidden-by-filter');
      }
    });
    return matchedOptions;
  }

  constructor(public host: ReactiveControllerHost & HTMLElement, options: ListboxConfigOptions) {
    this.host.addController(this);
    this.#internals = new InternalsController(this.host, {
      role: 'listbox'
    });
    this.#tabindex = new RovingTabindexController<HTMLElement>(this.host);
    this.#caseSensitive = options.caseSensitive || false;
    this.disableFilter = !!options.disableFilter;
  }

  /**
   * adds event listeners to host
   */
  hostConnected() {
    for (const [event, listener] of Object.entries(this.#listeners)) {
      this.host?.addEventListener(event, listener as (event: Event | null) => void);
    }
  }

  /**
   * removes event listeners from host
   */
  hostDisconnected() {
    for (const [event, listener] of Object.entries(this.#listeners)) {
      this.host?.removeEventListener(event, listener as (event: Event | null) => void);
    }
  }

  /**
   * verfies that selected options are limited to exisiting listbox options
   */
  isValid(val: string | null) {
    const vals = val?.split(',') || [];
    const options = this.options.map(option => option.textContent);
    return vals.every(val => {
      return options.includes(val);
    });
  }

  /**
   * sets focus on last active item
   */
  focus() {
    this.#tabindex.focusOnItem(this.#tabindex.activeItem);
  }

  /**
   * updates active descendant when focus changes
   */
  #updateActiveDescendant() {
    this.options.forEach(option => {
      if (option === this.#tabindex.activeItem && this.visibleOptions.includes(option)) {
        this.#internals.ariaActivedescendant = option.id;
        option.setAttribute('active-descendant', 'active-descendant');
      } else {
        if (this.#internals.ariaActivedescendant === option.id) {
          this.#internals.ariaActivedescendant = null;
        }
        option.removeAttribute('active-descendant');
      }
    });
  }

  /**
   * updates option selections for single select listbox
   */
  #updateSingleselect() {
    if (!this.multiSelectable) {
      this.options.forEach(option => option.selected = option.id === this.#internals.ariaActivedescendant);
      this.#fireChange();
    }
  }

  /**
   * updates option selections for multiselectable listbox:
   * toggles all options between active descendant and target
   * @param currentItem
   * @param referenceItem
   * @param ctrlKey
   */
  #updateMultiselect(currentItem: ListboxOptionElement, referenceItem = this.activeItem, ctrlKey = false) {
    if (this.multiSelectable) {
      // select all options between active descendant and target
      const [start, end] = [this.options.indexOf(referenceItem), this.options.indexOf(currentItem)].sort();
      const options = [...this.options].slice(start, end + 1);
      // if all items in range are toggled, remove toggle
      const allSelected = ctrlKey && options.filter(option => !option.selected)?.length === 0;
      const toggle = ctrlKey && allSelected ? false : ctrlKey ? true : referenceItem.selected;
      options.forEach(option => option.selected = toggle);
      this.#shiftStartingItem = currentItem;
    }
  }

  /**
   * handles user user selection change similar to HTMLSelectElement events
   * (@see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement#events|MDN: HTMLSelectElement Events})
   * @fires change
   */
  #fireChange() {
    this.host.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * handles element value change similar to HTMLSelectElement events
   * (@see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement#events|MDN: HTMLSelectElement Events})
   * @fires input
   */
  #fireInput() {
    this.host.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * handles updates to filter text:
   * hides options that do not match filter settings
   * and updates active descendant based on which options are still visible
   * @returns void
   */
  #onFilterChange() {
    if (this.disabled) {
      return;
    }
    const oldValue = this.value;

    if (this.#updateFocus) {
      this.#tabindex.updateItems(this.visibleOptions);
      this.#updateFocus = false;
    } else {
      this.#tabindex.initItems(this.visibleOptions);
    }
    if (oldValue !== this.value) {
      this.#fireInput();
    }
  }

  /**
   * handles focusing on an option:
   * updates roving tabindex and active descendant
   * @param event {FocusEvent}
   * @returns void
   */
  #onOptionFocus(event: FocusEvent) {
    const target = event.target as ListboxOptionElement;
    if (target !== this.#tabindex.activeItem) {
      this.#tabindex.updateActiveItem(target);
    }
    this.#updateActiveDescendant();
  }

  /**
   * handles clicking on a listbox option:
   * which selects an item by default
   * or toggles selection if multiselectable
   * @param event {MouseEvent}
   * @returns void
   */
  #onOptionClick(event: MouseEvent) {
    const target = event.target as ListboxOptionElement;
    const oldValue = this.value;
    if (this.multiSelectable) {
      if (!event.shiftKey) {
        target.selected = !target.selected;
      } else {
        if (this.#shiftStartingItem && target) {
          this.#updateMultiselect(target, this.#shiftStartingItem);
          this.#fireChange();
        }
      }
    } else {
      // select target and deselect all other options
      this.options.forEach(option => option.selected = option === target);
    }
    if (target !== this.#tabindex.activeItem) {
      this.#tabindex.focusOnItem(target);
      this.#updateActiveDescendant();
    }
    if (oldValue !== this.value) {
      this.#fireChange();
    }
  }

  /**
   * handles keyup:
   * track whether shift key is being used for multiselectable listbox
   * @param event {KeyboardEvent}
   * @returns void
   */
  #onOptionKeyup(event: KeyboardEvent) {
    const target = event.target as ListboxOptionElement;
    if (event.shiftKey && this.multiSelectable) {
      if (this.#shiftStartingItem && target) {
        this.#updateMultiselect(target, this.#shiftStartingItem);
        this.#fireChange();
      }
      if (event.key === 'Shift') {
        this.#shiftStartingItem = null;
      }
    }
  }

  /**
   * handles keydown:
   * filters listbox by keboard event when slotted option has focus,
   * or by external element such as a text field
   * @param event {KeyboardEvent}
   * @returns void
   */
  #onOptionKeydown(event: KeyboardEvent) {
    this.#showAllOptions = false;

    // need to set for keyboard support of multiselect
    if (event.key === 'Shift' && this.multiSelectable) {
      this.#shiftStartingItem = this.activeItem;
    }
    const target = event.target as ListboxOptionElement;
    const oldValue = this.value;
    let stopEvent = false;
    let focusEvent: ListboxOptionElement | undefined;
    if (event.altKey ||
      event.metaKey) {
      return;
    } else if (event.ctrlKey) {
      if (event.key?.match(/^[aA]$/)?.input && this.#tabindex.firstItem) {
        // ctrl+A selects all options
        this.#updateMultiselect(this.#tabindex.firstItem as ListboxOptionElement, this.#tabindex.lastItem as ListboxOptionElement, true);
        stopEvent = true;
      } else {
        return;
      }
    } else {
      switch (event.key) {
        case event.key?.match(/^[\w]$/)?.input:
          focusEvent = this.#nextMatchingItem(event.key);
          stopEvent = true;
          break;
        case 'Enter':
        case ' ':
          // enter and space are only applicable if a listbox option is clicked
          // an external text input should not trigger multiselect
          if (target) {
            if (this.multiSelectable) {
              if (event.shiftKey) {
                this.#updateMultiselect(target);
              } else {
                target.selected = !target.selected;
              }
            } else {
              this.#updateSingleselect();
            }
            stopEvent = true;
          }
          break;
        default:
          break;
      }
    }
    if (stopEvent) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (oldValue !== this.value) {
      this.#fireChange();
    }
    // only change focus if keydown occurred when option has focus
    // (as opposed to an external text input and if filter has changed
    if (focusEvent) {
      this.#tabindex.focusOnItem(focusEvent);
    }
  }

  #nextMatchingItem(key: string) {
    const items = [...this.visibleOptions];
    const index = !this.activeItem ? items.indexOf(this.activeItem) : -1;
    const sequence = [...items.slice(index), ...items.slice(0, index)];
    const regex = new RegExp(`^${key}`, this.#caseSensitive ? '' : 'i');
    const first = sequence.find(item => {
      const option = item as ListboxOptionElement;
      return !option.hasAttribute('disabled') && !option.hidden && option.textContent?.match(regex);
    });
    return first || undefined;
  }
}

import { expect, html } from '@open-wc/testing';
import { createFixture } from '@patternfly/pfe-tools/test/create-fixture.js';
import { PfSelect } from '../pf-select.js';
import { PfSelectOption } from '../pf-select-option.js';
import { sendKeys, sendMouse } from '@web/test-runner-commands';

const OPTIONS = html`
  <pf-select-option value="Blue">Blue</pf-select-option>
  <pf-select-option value="Green">Green</pf-select-option>
  <pf-select-option value="Magenta">Magenta</pf-select-option>
  <pf-select-option value="Orange">Orange</pf-select-option>
  <pf-select-option value="Purple">Purple</pf-select-option>
  <pf-select-option value="Pink">Pink</pf-select-option>
  <pf-select-option value="Red">Red</pf-select-option>
  <pf-select-option value="Yellow">Yellow</pf-select-option>`;

let element: PfSelect;
let optionsList: Element[];
let first: HTMLElement;
let second: HTMLElement;
let third: HTMLElement;
let fourth: HTMLElement;
let fifth: HTMLElement;
let sixth: HTMLElement;

async function shiftHold() {
  await sendKeys({ down: 'Shift' });
}

async function shiftRelease() {
  await sendKeys({ up: 'Shift' });
}
async function ctrlA() {
  await sendKeys({ down: 'Control' });
  await sendKeys({ down: 'a' });
  await sendKeys({ up: 'a' });
  await sendKeys({ up: 'Control' });
}

async function tab() {
  await sendKeys({ press: 'Tab' });
  await element.updateComplete;
}

async function arrowRight() {
  await sendKeys({ down: 'ArrowRight' });
  await element.updateComplete;
}

function isVisible(el: HTMLElement) {
  const comp = window.getComputedStyle(el);
  const display = comp.getPropertyValue('display');
  return display !== 'none';
}

async function click(element: HTMLElement) {
  const { x, y, width, height } = element.getBoundingClientRect();
  const position = [x + width / 2, y + height / 2].map(Math.round) as [number, number];
  await sendMouse({ type: 'click', position });
}

describe('<pf-select>', function() {
  describe('simply instantiating', function() {
    it('imperatively instantiates', function() {
      expect(document.createElement('pf-select')).to.be.an.instanceof(PfSelect);
    });

    it('should upgrade', async function() {
      element = await createFixture<PfSelect>(html`<pf-select></pf-select>`);
      const klass = customElements.get('pf-select');
      expect(element)
        .to.be.an.instanceOf(klass)
        .and
        .to.be.an.instanceOf(PfSelect);
    });

    describe('single select `always-open`', function() {
      beforeEach(async function() {
        element = await createFixture<PfSelect>(html`
          <pf-select always-open>
            <pf-select-option disabled selected>Select a color</pf-select-option>
            ${OPTIONS}
          </pf-select>`);
        optionsList = [...element.querySelectorAll('pf-select-option:not([disabled])')];
        [first, second, third, fourth, fifth, sixth] = optionsList as HTMLElement[];
        await element.updateComplete;
      });

      describe('should be accessible', function() {
        it('`Tab` key focuses on first focusable option', async function() {
          await tab();
          await element.updateComplete;
          await expect(document.activeElement).to.equal(first);
        });
        it('`ArrowRight` key focuses on second focusable option', async function() {
          first.focus();
          await arrowRight();
          await element.updateComplete;
          await expect(document.activeElement).to.equal(second);
        });
        it('is accessible', async function() {
          await expect(element).to.be.accessible();
        });
      });

      describe('filters correctly', function() {
        it('`p` hides "Blue" option', async function() {
          element.caseSensitive = false;
          element.filter = 'p';
          await element.updateComplete;
          expect(isVisible(first)).to.be.false;
        });
        it('`disable-filter` shows all options', async function() {
          element.filter = 'p';
          element.disableFilter = true;
          element.caseSensitive = false;
          element.matchAnywhere = false;
          await element.updateComplete;
          const visible = optionsList.filter(opt => isVisible(opt as HTMLElement));
          expect(visible.length).to.be.equal(optionsList.length);
        });
        it('`t` shows "Magenta" option when match anywhere', async function() {
          element.disableFilter = false;
          element.caseSensitive = false;
          element.matchAnywhere = true;
          element.filter = 't';
          await element.updateComplete;
          expect(isVisible(third)).to.be.true;
        });
        it('`g` hides "Green" option when case sensitive', async function() {
          element.disableFilter = false;
          element.caseSensitive = true;
          element.matchAnywhere = true;
          element.filter = 'p';
          await element.updateComplete;
          expect(isVisible(second)).to.be.false;
        });
        it('`*` shows all options', async function() {
          element.disableFilter = false;
          element.filter = '*';
          await element.updateComplete;
          const visible = optionsList.filter(opt => isVisible(opt as HTMLElement));
          expect(visible.length).to.be.equal(optionsList.length);
        });
      });

      describe('single select', function() {
        it('updates selected option on focus', async function() {
          third.focus();
          await element.updateComplete;
          expect(element.selected).to.equal(third);
        });
        it('updates selected option on click', async function() {
          await click(fifth);
          expect(element.selected).to.equal(fifth);
        });
      });
    });

    describe('multiple select `always-open`', function() {
      beforeEach(async function() {
        element = await createFixture<PfSelect>(html`<pf-select multi-selectable always-open>${OPTIONS}</pf-select>`);
        optionsList = [...element.querySelectorAll('pf-select-option:not([disabled])')];
        [first, second, third, fourth, fifth, sixth] = optionsList as HTMLElement[];
        await click(first);
        await click(fifth);
        await element.updateComplete;
      });
      it('adds options on click', async function() {
        await click(fourth);
        await click(sixth);
        await element.updateComplete;
        const selected = element.selected as HTMLElement[];
        const correct = selected.includes(fourth) && selected.includes(sixth);
        expect(correct).to.be.true;
      });
      it('removes toggled option on click', async function() {
        await click(fifth);
        const selected = element.selected as HTMLElement[];
        const correct = !selected.includes(fifth);
        await element.updateComplete;
        expect(correct).to.be.true;
      });
      it('selects multiple options', async function() {
        await click(second);
        await shiftHold();
        await click(sixth);
        await shiftRelease();
        await element.updateComplete;
        const selected = element.selected as HTMLElement[];
        expect(selected.length).to.equal(6);
      });
      it('deselects multiple options', async function() {
        await click(first);
        await shiftHold();
        await click(sixth);
        await shiftRelease();
        await element.updateComplete;
        const selected = element.selected as HTMLElement[];
        expect(selected.length).to.equal(0);
      });
      it('selects all options', async function() {
        await ctrlA();
        await element.updateComplete;
        const selected = element.selected as HTMLElement[];
        expect(selected.length).to.equal(8);
      });
    });
  });
});

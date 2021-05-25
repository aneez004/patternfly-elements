import { PfeCollapseToggle } from "../../pfe-collapse/dist/pfe-collapse.js";
import PfeIcon from "../../pfe-icon/dist/pfe-icon.js";

class PfeAccordionHeader extends PfeCollapseToggle {
  static get tag() {
    return "pfe-accordion-header";
  }

  get styleUrl() {
    return "pfe-accordion-header.scss";
  }

  get templateUrl() {
    return "pfe-accordion-header.html";
  }

  get isDirectLink() {
    return this.hasAttribute("is-direct-link");
  }

  get link() {
    return this.querySelector("a");
  }

  get button() {
    return this.shadowRoot.querySelector(`.pf-c-accordion__toggle`);
  }

  static get properties() {
    return {
      _id: {
        type: String,
        default: el => `${el.randomId.replace("pfe", el.tag)}`,
        attr: "id",
        prefix: false
      },
      // ariaControls: {
      //   type: String,
      //   prefix: false
      // },
      // @TODO Deprecated pfe-id in 1.0
      oldPfeId: {
        type: String,
        alias: "_id",
        attr: "pfe-id"
      },
      // expanded: {
      //   title: "Expanded",
      //   type: Boolean,
      //   default: false
      // }
    };
  }

  constructor() {
    super(PfeAccordionHeader, { setTabIndex: false } );

    this._init = this._init.bind(this);

    this._observer = new MutationObserver(this._init);
    this._slotObserver = new MutationObserver(this._init);

    this._getHeaderElement = this._getHeaderElement.bind(this);

    this.headingTag = "h3";
  }

  connectedCallback() {
    super.connectedCallback();

    // Capture the button and the text
    this._buttonText = this.button.querySelector(`.pf-c-accordion__toggle-text`);

    // This validates if HTML _or_ textContent exists inside the component
    if (this.hasLightDOM()) this._init();
    else {
      this._observer.observe(this, {
        childList: true
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._observer.disconnect();
  }

  _init() {
    if (window.ShadyCSS) this._observer.disconnect();

    const header = this._getHeaderElement();
    if (header) {
      this.headingTag = header.tagName.toLowerCase();
      this.headingText = header.textContent.trim();
    } else {
      this.headingText = this.getSlot().textContent.trim();
    }

    // Update button text
    this._buttonText.innerHTML = this.headingText;

    // Remove the hidden attribute after upgrade
    this.removeAttribute("hidden");

    // Validate that headers with the `is-direct-link` attribute contain a link
    if (this.isDirectLink && !this.querySelector("a[href]:not([href^='#'])")) {
      this.warn(`This component expects to find a link in the light DOM due to the "is-direct-link" attribute`);
    }

    if (window.ShadyCSS)
      this._observer.observe(this, {
        childList: true
      });
  }

  _getHeaderElement() {
    // Check if there is no nested element or nested textNodes
    if (!this.firstElementChild && !this.firstChild) {
      this.warn(`No header content provided`);
      return;
    }

    if (this.firstElementChild && this.firstElementChild.tagName) {
      // If the first element is a slot, query for it's content
      if (this.firstElementChild.tagName === "SLOT") {
        const slotted = this.firstElementChild.assignedNodes();
        // If there is no content inside the slot, return empty with a warning
        if (slotted.length === 0) {
          this.warn(`No heading information exists within this slot.`);
          return;
        }
        // If there is more than 1 element in the slot, capture the first h-tag
        if (slotted.length > 1) this.warn(`Heading currently only supports 1 tag.`);
        const htags = slotted.filter(slot => slot.tagName.match(/^H[1-6]/) || slot.tagName === "P");
        if (htags.length > 0) {
          // Return the first htag and attach an observer event to watch for it
          slotted.forEach(slot =>
            this._slotObserver.observe(slot, {
              characterData: true,
              childList: true,
              subtree: true
            })
          );
          return htags[0];
        } else return;
      } else if (this.firstElementChild.tagName.match(/^H[1-6]/) || this.firstElementChild.tagName === "P") {
        return this.firstElementChild;
      } else {
        this.warn(`Heading should contain at least 1 heading tag for correct semantics.`);
      }
    }

    return;
  }
}

export default PfeAccordionHeader;

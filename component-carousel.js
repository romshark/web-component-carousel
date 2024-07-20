class ComponentCarousel extends HTMLElement {
  #nodeElements;
  #nodeThumbnails;

  #keyBack = "ArrowLeft";
  #keyForth = "ArrowRight";
  #currentIndex = 0;
  #loop = true;
  #dragThreshold = 200;
  #drag = false;

  #dragInitialTranslateX = 0;
  #dragInitialMouseX = 0;
  #dragClientX = 0;

  #handlerOnKeyboardEvent;
  #handlerOnDragStart;
  #handlerOnDragEnd;
  #handlerOnDragging;

  static get observedAttributes() {
    return ["index", "drag-threshold", "loop", "drag", "key-back", "key-forth"];
  }

  constructor() {
    super();

    const html = String.raw;

    const shadowDOM = this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = html`
      <style>
        #root {
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-flow: row wrap;
        }
        #root img {
          user-drag: none;
          -webkit-user-drag: none;
          user-select: none;
          -moz-user-select: none;
          -webkit-user-select: none;
          -ms-user-select: none;
        }
        slot {
          display: none;
        }
        #container {
          width: 100%;
          height: 80%;
          overflow: hidden;
        }
        #elements {
          width: 100%;
          height: 100%;
          display: flex;
          flex-flow: row nowrap;
          align-items: center;
        }
        #elements > * {
          opacity: 100%;
          object-fit: contain;
          flex: 0 0 100%;
          width: 100%;
          height: 100%;
          user-select: none;
          user-drag: none;
          -webkit-user-drag: none;
          user-select: none;
          -moz-user-select: none;
          -webkit-user-select: none;
          -ms-user-select: none;
        }
        #thumbnails-container {
          width: 100%;
          height: calc(20% - 0.5rem);
          padding-top: 0.5rem;
          overflow: hidden;
          overflow-x: scroll;
        }
        #thumbnails {
          display: flex;
          flex-flow: row nowrap;
          height: 100%;
          width: 100%;
          min-width: max-content;
          gap: 0.5rem;
          user-select: none;
          justify-content: center;
        }
        #thumbnails > * {
          object-fit: cover;
          height: 100%;
          user-select: none;
          box-sizing: border-box;
          max-height: 100%;
        }
        .elements-transition {
          transition: transform ease 0.6s;
        }
        .draggable {
          cursor: move; /* Fallback if grab cursor is unsupported */
          cursor: grab;
          cursor: -moz-grab;
          cursor: -webkit-grab;
        }
        .dragged {
          cursor: grabbing;
          cursor: -moz-grabbing;
          cursor: -webkit-grabbing;
        }
        .thumbnail-selected {
          border: 2px solid black;
        }
        .thumbnail-deselected {
          border: 0px;
        }
      </style>
      <div id="root">
        <slot></slot>
        <slot name="original"></slot>
        <slot name="thumbnail"></slot>
        <div id="container">
          <div id="elements" class="elements-transition"></div>
        </div>
        <div id="thumbnails-container">
          <div id="thumbnails"></div>
        </div>
      </div>
    `;
    shadowDOM.append(template.content.cloneNode(true));
    this.#nodeElements = shadowDOM.getElementById("elements");
    this.#nodeThumbnails = shadowDOM.getElementById("thumbnails");

    const slotDefault = shadowDOM.querySelector("slot");
    const slotThumbnails = shadowDOM.querySelector('slot[name="thumbnail"]');
    const slotOriginals = shadowDOM.querySelector('slot[name="original"]');

    const warnHelpMsg =
      'Make sure you have at least as many items in slot "original" ' +
      'as in the slot "thumbnail", or that slot "thumbnail" is empty.';

    slotOriginals.addEventListener("slotchange", () => {
      slotDefault.assignedNodes().forEach((node) => {
        if (
          node.nodeType === Node.TEXT_NODE ||
          node.nodeType === Node.COMMENT_NODE
        ) {
          return; // Ignore comments and plain text
        } else if (node.nodeName === "STYLE") {
          shadowDOM.append(node);
          return;
        }
        console.warn(
          "unsupported node in default slot: ",
          node,
          "only <style> is supported"
        );
      });

      const origs = slotOriginals
        .assignedNodes()
        .filter((node) => node.nodeType === Node.ELEMENT_NODE);
      let thumbs = slotThumbnails
        .assignedNodes()
        .filter((node) => node.nodeType === Node.ELEMENT_NODE);

      if (thumbs.length > 0 && thumbs.length > origs.length) {
        console.warn(
          'Falling back to using items from slot "original" as thumbnails ' +
            `because slot "thumbnail" has ${thumbs.length} item(s) ` +
            `while slot "original" has only ${origs.length} item(s). ` +
            warnHelpMsg
        );
        thumbs = origs;
      }

      origs.forEach((node, index) => {
        const cloneElement = node.cloneNode(true);
        this.#nodeElements.appendChild(cloneElement);

        let thumbNode = node;
        if (thumbs.length > 0) {
          if (index >= thumbs.length) {
            // Warn and use original as fallback
            console.warn(
              `Item from slot "original" is missing a counterpart ` +
                `from the slot "thumbnail" at index ${index}. ` +
                warnHelpMsg
            );
          } else {
            // Use thumbnail counterpart
            thumbNode = thumbs[index];
          }
        }
        const cloneThumbnail = thumbNode.cloneNode(true);
        cloneThumbnail.addEventListener("click", () => {
          this.goTo(index);
        });
        this.#nodeThumbnails.appendChild(cloneThumbnail);
      });
      // Update index attribute
      this.attributeChangedCallback("index", null, this.getAttribute("index"));
      this.goTo(this.#currentIndex, {
        instant: true,
        thumbnailsScrollBehavior: "instant",
      });
    });

    // Bind event handlers
    this.#handlerOnKeyboardEvent = this.#onKeyboardEvent.bind(this);
    this.#handlerOnDragStart = this.#onDragStart.bind(this);
    this.#handlerOnDragEnd = this.#onDragEnd.bind(this);
    this.#handlerOnDragging = this.#onDragging.bind(this);
  }

  connectedCallback() {
    window.addEventListener("keydown", this.#handlerOnKeyboardEvent);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.#handlerOnKeyboardEvent);
    this.#nodeElements.removeEventListener(
      "mousedown",
      this.#handlerOnDragStart
    );
    this.#nodeElements.removeEventListener(
      "touchstart",
      this.#handlerOnDragStart
    );
    document.removeEventListener("mouseup", this.#handlerOnDragEnd);
    document.removeEventListener("touchend", this.#handlerOnDragEnd);
    document.removeEventListener("mousemove", this.#handlerOnDragging);
    document.removeEventListener("touchmove", this.#handlerOnDragging);
  }

  attributeChangedCallback(name, _, newValue) {
    switch (name) {
      case "index": {
        const attrIndex = parseInt(newValue);
        if (!isNaN(attrIndex)) {
          this.#currentIndex =
            attrIndex >= 0 && attrIndex < this.length ? attrIndex : 0;
        }
        break;
      }
      case "loop": {
        this.#loop = newValue === "false" ? false : true;
        break;
      }
      case "drag": {
        if (this.getAttribute("drag") === "false" && this.#drag) {
          // Disable drag
          this.#drag = false;
          this.#nodeElements.removeEventListener(
            "mousedown",
            this.#handlerOnDragStart
          );
          this.#nodeElements.removeEventListener(
            "touchstart",
            this.#handlerOnDragStart
          );
          this.#nodeElements.classList.remove("draggable");
        } else if (!this.#drag) {
          // Enable drag
          this.#drag = true;
          this.#nodeElements.addEventListener(
            "mousedown",
            this.#handlerOnDragStart
          );
          this.#nodeElements.addEventListener(
            "touchstart",
            this.#handlerOnDragStart,
            { passive: true }
          );
          this.#nodeElements.classList.add("draggable");
        }
        break;
      }
      case "drag-threshold": {
        const a = parseInt(newValue);
        if (!isNaN(a)) {
          this.#dragThreshold = a < 0 ? 0 : a;
        }
        break;
      }
      case "key-back": {
        this.#keyBack = newValue === "false" ? null : newValue;
        break;
      }
      case "key-forth": {
        this.#keyForth = newValue === "false" ? null : newValue;
        break;
      }
    }
  }

  // length returns the number of items in the carousel.
  get length() {
    return this.#nodeElements.children.length;
  }

  // moveBy moves from the current index by delta.
  // For example -1 means move to the previous index.
  // if either -(delta) or delta is > number of elements then
  // moveBy does nothing and returns.
  moveBy(delta, options) {
    delta = parseInt(delta);
    if (delta >= 0 && delta >= this.length) {
      return;
    } else if (delta < 0 && -delta >= this.length) {
      return;
    }

    if (
      !this.#loop &&
      (this.#currentIndex + delta < 0 ||
        this.#currentIndex + delta >= this.length)
    ) {
      return;
    }

    this.#currentIndex += delta;
    if (this.#currentIndex >= this.length) {
      this.#currentIndex -= this.length;
    } else if (this.#currentIndex < 0) {
      this.#currentIndex = this.length + this.#currentIndex;
    }
    this.goTo(this.#currentIndex, options);
  }

  // goTo moves to the given index. No-op if index is out of bound.
  goTo(index, options) {
    index = parseInt(index);
    if (index < 0 || index >= this.length) {
      return;
    }
    this.#currentIndex = index;

    const imagesShiftPercent = -(this.#currentIndex * 100);
    this.#nodeElements.style.transform = `translateX(${imagesShiftPercent}%)`;

    if (options && options.instant === true) {
      this.#disableElementsTransition();
      // Defer re-enable transitions to perform the switch first
      setTimeout(() => {
        this.#enableElementsTransition();
      });
    }

    for (let i = 0; i < this.#nodeThumbnails.children.length; i++) {
      const thumbnail = this.#nodeThumbnails.children[i];
      if (i == this.#currentIndex) {
        thumbnail.classList.add("thumbnail-selected");
        thumbnail.classList.remove("thumbnail-deselected");
      } else {
        thumbnail.classList.remove("thumbnail-selected");
        thumbnail.classList.add("thumbnail-deselected");
      }
    }
    const thumbnailsScrollBehavior =
      options && options.thumbnailsScrollBehavior
        ? options.thumbnailsScrollBehavior
        : "smooth";
    this.#scrollThumbnailIntoView(thumbnailsScrollBehavior);
  }

  #onKeyboardEvent(event) {
    if (event.key === this.#keyBack) {
      this.moveBy(-1);
    } else if (event.key === this.#keyForth) {
      this.moveBy(1);
    }
  }

  #disableElementsTransition() {
    this.#nodeElements.classList.remove("elements-transition");
  }
  #enableElementsTransition() {
    this.#nodeElements.classList.add("elements-transition");
  }

  #getCurrentTranslateX() {
    const c = window.getComputedStyle(this.#nodeElements);
    return new DOMMatrix(c.transform).m41;
  }

  #setDragClientX(event) {
    if (event.touches && event.touches.length > 0) {
      this.#dragClientX = event.touches[0].clientX;
    } else if (event.clientX != undefined) {
      // This triggers on non-touch devices where a mouse position is available.
      this.#dragClientX = event.clientX;
    }
    return this.#dragClientX;
  }

  #onDragStart(event) {
    document.addEventListener("mouseup", this.#handlerOnDragEnd);
    document.addEventListener("touchend", this.#handlerOnDragEnd);
    document.addEventListener("mousemove", this.#handlerOnDragging);
    document.addEventListener("touchmove", this.#handlerOnDragging);

    this.#nodeElements.classList.add("dragged");
    this.#dragInitialTranslateX = this.#getCurrentTranslateX();
    this.#dragInitialMouseX = this.#setDragClientX(event);
    this.#dragClientX = 0;
    this.#disableElementsTransition();
  }

  #onDragEnd(event) {
    this.#nodeElements.classList.remove("dragged");
    document.removeEventListener("mouseup", this.#handlerOnDragEnd);
    document.removeEventListener("touchend", this.#handlerOnDragEnd);
    document.removeEventListener("mousemove", this.#handlerOnDragging);
    document.removeEventListener("touchmove", this.#handlerOnDragging);
    this.#enableElementsTransition();

    const clientX = this.#setDragClientX(event);
    if (clientX == 0) {
      return;
    }

    const delta = this.#dragInitialMouseX - clientX;
    if (delta == 0) {
      return;
    }
    if (delta < 0 && -delta > this.#dragThreshold) {
      if (this.#currentIndex < 1) {
        this.goTo(this.#currentIndex);
        return;
      }
      this.moveBy(-1);
      return;
    }
    if (delta > this.#dragThreshold) {
      if (this.#currentIndex + 1 >= this.length) {
        this.goTo(this.#currentIndex);
        return;
      }
      this.moveBy(1);
      return;
    }
    this.goTo(this.#currentIndex);
  }

  #onDragging(event) {
    const delta = this.#dragInitialMouseX - this.#setDragClientX(event);
    const by = -this.#dragInitialTranslateX + delta;
    if (this.#currentIndex + 1 >= this.length && delta > 0) {
      return;
    }
    this.#nodeElements.style.transform = `translateX(-${by}px)`;
  }

  #scrollThumbnailIntoView(behavior) {
    const t = this.#nodeThumbnails.children[this.#currentIndex];
    if (t) {
      t.scrollIntoView({
        behavior: behavior,
        inline: "center",
        block: "nearest",
      });
    }
  }
}
customElements.define("component-carousel", ComponentCarousel);

/**
 *
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function(document) {

  /* Symbols for private properties */
  const _blockingElements = Symbol();
  const _alreadyInertElements = Symbol();
  const _topParents = Symbol();
  const _inertedSiblings = Symbol();

  /* Symbols for private static methods */
  const _topChanged = Symbol();
  const _swapInertedSibling = Symbol();
  const _inertSiblings = Symbol();
  const _restoreInertedSiblings = Symbol();
  const _getParents = Symbol();
  const _getDistributedChildren = Symbol();
  const _isNotInertable = Symbol();
  const _isInert = Symbol();
  const _setInert = Symbol();

  /**
   * `BlockingElements` manages a stack of elements that inert the interaction
   * outside them. The top element is the interactive part of the document.
   * The stack can be updated with the methods `push, remove, pop`.
   */
  class BlockingElements {
    constructor() {

      /**
       * The blocking elements.
       * @type {Array<HTMLElement>}
       * @private
       */
      this[_blockingElements] = [];

      /**
       * The parents of the top element.
       * @type {Array<HTMLElement>}
       * @private
       */
      this[_topParents] = [];

      /**
       * Elements that are already inert before the first blocking element is pushed.
       * @type {Set<HTMLElement>}
       * @private
       */
      this[_alreadyInertElements] = new Set();
    }

    /**
     * Call this whenever this object is about to become obsolete. This empties
     * the blocking elements
     */
    destructor() {
      // Restore original inertness.
      this[_restoreInertedSiblings](this[_topParents]);
      this[_blockingElements] = null;
      this[_topParents] = null;
      this[_alreadyInertElements] = null;
    }

    /**
     * The top blocking element.
     * @type {HTMLElement|null}
     */
    get top() {
      const elems = this[_blockingElements];
      return elems[elems.length - 1] || null;
    }

    /**
     * Adds the element to the blocking elements.
     * @param {!HTMLElement} element
     */
    push(element) {
      if (this.has(element)) {
        console.warn('element already added in document.blockingElements');
        return;
      }
      this[_topChanged](element);
      this[_blockingElements].push(element);
    }

    /**
     * Removes the element from the blocking elements. Returns true if the element
     * was removed.
     * @param {!HTMLElement} element
     * @returns {boolean}
     */
    remove(element) {
      const i = this[_blockingElements].indexOf(element);
      if (i === -1) {
        return false;
      }
      this[_blockingElements].splice(i, 1);
      // Top changed only if the removed element was the top element.
      if (i === this[_blockingElements].length) {
        this[_topChanged](this.top);
      }
      return true;
    }

    /**
     * Remove the top blocking element and returns it.
     * @returns {HTMLElement|null} the removed element.
     */
    pop() {
      const top = this.top;
      top && this.remove(top);
      return top;
    }

    /**
     * Returns if the element is a blocking element.
     * @param {!HTMLElement} element
     * @returns {boolean}
     */
    has(element) {
      return this[_blockingElements].indexOf(element) !== -1;
    }

    /**
     * Sets `inert` to all document elements except the new top element, its parents,
     * and its distributed content.
     * @param {?HTMLElement} newTop If null, it means the last blocking element was removed.
     * @private
     */
    [_topChanged](newTop) {
      const keepInert = this[_alreadyInertElements];
      const oldParents = this[_topParents];
      const newParents = this[_getParents](newTop);
      this[_topParents] = newParents;
      // No new top, reset old top if any.
      if (!newTop) {
        this[_restoreInertedSiblings](oldParents);
        keepInert.clear();
        return;
      }

      const toSkip = this[_getDistributedChildren](newTop);

      // No previous top element.
      if (!oldParents.length) {
        this[_inertSiblings](newParents, toSkip, keepInert);
        return;
      }

      let i = oldParents.length - 1;
      let j = newParents.length - 1;
      // Find common parent.
      while (oldParents[i] === newParents[j]) {
        i--;
        j--;
      }
      // Old and new top share a common parent, so just swap the inerted sibling.
      this[_swapInertedSibling](oldParents[i], newParents[j], keepInert);
      // Restore old parents siblings inertness, make new parents siblings inert.
      this[_restoreInertedSiblings](oldParents.slice(0, i));
      this[_inertSiblings](newParents.slice(0, j), toSkip);
    }

    /**
     * Swaps inertness between two sibling elements.
     * @param {!HTMLElement} oldInert
     * @param {!HTMLElement} newInert
     * @param {!Set<HTMLElement>} keepInert
     * @private
     */
    [_swapInertedSibling](oldInert, newInert, keepInert) {
      const siblings = oldInert[_inertedSiblings];
      if (!keepInert.has(oldInert) && !this[_isInert](oldInert)) {
        this[_setInert](oldInert, true);
        siblings.add(oldInert);
      }
      if (!keepInert.has(newInert)) {
        this[_setInert](newInert, false);
        siblings.delete(newInert);
      }
      // Move inerted siblings to newInert.
      newInert[_inertedSiblings] = siblings;
      oldInert[_inertedSiblings] = null;
    }

    /**
     * Restores original inertness to the siblings of the elements.
     * @param {!Array<HTMLElement>} elements
     * @private
     */
    [_restoreInertedSiblings](elements) {
      for (let i = 0, l = elements.length; i < l; i++) {
        for (let sibling of elements[i][_inertedSiblings]) {
          this[_setInert](sibling, false);
        }
        elements[i][_inertedSiblings] = null;
      }
    }

    /**
     * Inerts the siblings of the elements except the elements to skip. Stores
     * the inerted siblings into the element's symbol `_inertedSiblings`.
     * Pass `keepInert` to collect the already inert elements.
     * @param {!Array<HTMLElement>} elements
     * @param {Set<HTMLElement>} toSkip
     * @param {Set<HTMLElement>} keepInert
     * @private
     */
    [_inertSiblings](elements, toSkip, keepInert) {
      for (let i = 0, l = elements.length; i < l; i++) {
        const element = elements[i];
        const children = element.parentNode.children;
        const inertedSiblings = new Set();
        for (let j = 0; j < children.length; j++) {
          const sibling = children[j];
          // Skip the input element, if not inertable or to be skipped.
          if (sibling === element || this[_isNotInertable](sibling) ||
            (toSkip && toSkip.has(sibling))) {
            continue;
          }
          // Should be collected since already inerted.
          if (keepInert && this[_isInert](sibling)) {
            keepInert.add(sibling);
          } else {
            this[_setInert](sibling, true);
            inertedSiblings.add(sibling);
          }
        }
        // Store the siblings that were inerted.
        element[_inertedSiblings] = inertedSiblings;
      }
    }

    /**
     * Returns if the element is not inertable.
     * @param {!HTMLElement} element
     * @returns {boolean}
     * @private
     */
    [_isNotInertable](element) {
      return /^(style|template|script|content|slot)$/.test(element.localName);
    }

    /**
     * Returns the list of newParents of an element, starting from element (included)
     * up to `document.body` (excluded).
     * @param {HTMLElement} element
     * @returns {Array<HTMLElement>}
     * @private
     */
    [_getParents](element) {
      const newParents = [];
      let current = element;
      // Stop to body.
      while (current && current !== document.body) {
        // Skip shadow roots.
        if (current.nodeType === Node.ELEMENT_NODE) {
          newParents.push(current);
        }
        // ShadowDom v1
        if (current.assignedSlot) {
          // Collect slots from deepest slot to top.
          while ((current = current.assignedSlot)) {
            newParents.push(current);
          }
          // Continue the search on the top slot.
          current = newParents.pop();
          continue;
        }
        // ShadowDom v0
        const insertionPoints = current.getDestinationInsertionPoints ?
          current.getDestinationInsertionPoints() : [];
        if (insertionPoints.length) {
          for (let i = 0; i < insertionPoints.length; i++) {
            newParents.push(insertionPoints[i]);
          }
          // Continue the search on the top content.
          current = newParents.pop();
          continue;
        }
        current = current.parentNode || current.host;
      }
      return newParents;
    }

    /**
     * Returns the distributed children of the element's shadow root.
     * Returns null if the element doesn't have a shadow root.
     * @param {!element} element
     * @returns {Set<HTMLElement>|null}
     * @private
     */
    [_getDistributedChildren](element) {
      const shadowRoot = element.shadowRoot;
      if (!shadowRoot) {
        return null;
      }
      const result = new Set();
      let i, j, nodes;
      // ShadowDom v1
      const slots = shadowRoot.querySelectorAll('slot');
      if (slots.length && slots[0].assignedNodes) {
        for (i = 0; i < slots.length; i++) {
          nodes = slots[i].assignedNodes({
            flatten: true
          });
          for (j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType === Node.ELEMENT_NODE) {
              result.add(nodes[j]);
            }
          }
        }
        // No need to search for <content>.
        return result;
      }
      // ShadowDom v0
      const contents = shadowRoot.querySelectorAll('content');
      if (contents.length && contents[0].getDistributedNodes) {
        for (i = 0; i < contents.length; i++) {
          nodes = contents[i].getDistributedNodes();
          for (j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType === Node.ELEMENT_NODE) {
              result.add(nodes[j]);
            }
          }
        }
      }
      return result;
    }

    /**
     * Returns if an element is inert.
     * @param {!HTMLElement} element
     * @returns {boolean}
     * @private
     */
    [_isInert](element) {
      return element.inert;
    }

    /**
     * Sets inert to an element.
     * @param {!HTMLElement} element
     * @param {boolean} inert
     * @private
     */
    [_setInert](element, inert) {
      // Prefer setting the property over the attribute since the inert spec
      // doesn't specify if it should be reflected.
      // https://html.spec.whatwg.org/multipage/interaction.html#inert
      element.inert = inert;
    }
  }

  document.$blockingElements = new BlockingElements();

})(document);

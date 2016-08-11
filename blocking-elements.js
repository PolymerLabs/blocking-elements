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
  const _topElement = Symbol();
  const _blockingElements = Symbol();
  const _alreadyInertElements = Symbol();

  /* Symbols for private static methods */
  const _topChanged = Symbol();
  const _setInertToSiblingsOfElement = Symbol();
  const _getParents = Symbol();
  const _getDistributedChildren = Symbol();
  const _isInertable = Symbol();
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
       * The top blocking element.
       * @type {HTMLElement}
       * @private
       */
      this[_topElement] = null;

      /**
       * The blocking elements.
       * @type {Set<HTMLElement>}
       * @private
       */
      this[_blockingElements] = new Set();

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
      // Pretend like top changed from current top to null in order to reset
      // all its parents inertness. Ensure we keep inert what was already inert!
      BlockingElements[_topChanged](null, this[_topElement], this[_alreadyInertElements]);
      this[_topElement] = null;
      this[_blockingElements] = null;
      this[_alreadyInertElements] = null;
    }

    /**
     * The top blocking element.
     * @type {HTMLElement|null}
     */
    get top() {
      return this[_topElement];
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
      this[_blockingElements].add(element);
      BlockingElements[_topChanged](element, this.top, this[_alreadyInertElements]);
      this[_topElement] = element;
    }

    /**
     * Removes the element from the blocking elements. Returns true if the element
     * was removed.
     * @param {!HTMLElement} element
     * @returns {boolean}
     */
    remove(element) {
      if (!this.has(element)) {
        return false;
      }
      this[_blockingElements].delete(element);
      // Top changed only if the removed element was the top element.
      if (element === this.top) {
        let newTop = null;
        for(newTop of this[_blockingElements]);
        this[_topElement] = newTop;
        BlockingElements[_topChanged](newTop, element, this[_alreadyInertElements]);
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
      return this[_blockingElements].has(element);
    }

    /**
     * Sets `inert` to all document elements except the new top element, its parents,
     * and its distributed content. Pass `oldTop` to limit element updates (will look
     * for common parents and avoid setting them twice).
     * When the first blocking element is added (`newTop = null`), it saves the elements
     * that are already inert into `alreadyInertElems`. When the last blocking element
     * is removed (`oldTop = null`), `alreadyInertElems` are kept inert.
     * @param {HTMLElement} newTop If null, it means the last blocking element was removed.
     * @param {HTMLElement} oldTop If null, it means the first blocking element was added.
     * @param {!Set<HTMLElement>} alreadyInertElems Elements to be kept inert.
     * @private
     */
    static[_topChanged](newTop, oldTop, alreadyInertElems) {
      const oldElParents = oldTop ? this[_getParents](oldTop) : [];
      const newElParents = newTop ? this[_getParents](newTop) : [];
      const elemsToSkip = newTop && newTop.shadowRoot ?
        this[_getDistributedChildren](newTop.shadowRoot) : null;
      // Loop from top to deepest elements, so we find the common parents and
      // avoid setting them twice.
      while (oldElParents.length || newElParents.length) {
        const oldElParent = oldElParents.pop();
        const newElParent = newElParents.pop();
        if (oldElParent === newElParent) {
          continue;
        }
        // Same parent, set only these 2 children.
        if (oldElParent && newElParent &&
          oldElParent.parentNode === newElParent.parentNode) {
          if (!oldTop && this[_isInert](oldElParent)) {
            alreadyInertElems.add(oldElParent);
          }
          this[_setInert](oldElParent, true);
          this[_setInert](newElParent, alreadyInertElems.has(newElParent));
        } else {
          oldElParent && this[_setInertToSiblingsOfElement](oldElParent, false, elemsToSkip,
            alreadyInertElems);
          // Collect the already inert elements only if it is the first blocking
          // element (if oldTop = null)
          newElParent && this[_setInertToSiblingsOfElement](newElParent, true, elemsToSkip,
            oldTop ? null : alreadyInertElems);
        }
      }
      if (!newTop) {
        alreadyInertElems.clear();
      }
    }

    /**
     * Returns if the element is not inertable.
     * @param {!HTMLElement} element
     * @returns {boolean}
     * @private
     */
    static[_isInertable](element) {
      return /^(style|template|script)$/.test(element.localName);
    }

    /**
     * Sets `inert` to the siblings of the element except the elements to skip.
     * If `inert = true`, already inert elements are added into `alreadyInertElems`.
     * If `inert = false`, siblings that are contained in `alreadyInertElems` will
     * be kept inert.
     * @param {!HTMLElement} element
     * @param {boolean} inert
     * @param {Set<HTMLElement>} elemsToSkip
     * @param {Set<HTMLElement>} alreadyInertElems
     * @private
     */
    static[_setInertToSiblingsOfElement](element, inert, elemsToSkip, alreadyInertElems) {
      // Previous siblings.
      let sibling = element;
      while ((sibling = sibling.previousElementSibling)) {
        // If not inertable or to be skipped, skip.
        if (this[_isInertable](sibling) || (elemsToSkip && elemsToSkip.has(sibling))) {
          continue;
        }
        // Should be collected since already inerted.
        if (alreadyInertElems && inert && this[_isInert](sibling)) {
          alreadyInertElems.add(sibling);
        }
        // Should be kept inert if it's in `alreadyInertElems`.
        this[_setInert](sibling, inert || (alreadyInertElems && alreadyInertElems.has(sibling)));
      }
      // Next siblings.
      sibling = element;
      while ((sibling = sibling.nextElementSibling)) {
        // If not inertable or to be skipped, skip.
        if (this[_isInertable](sibling) || (elemsToSkip && elemsToSkip.has(sibling))) {
          continue;
        }
        // Should be collected since already inerted.
        if (alreadyInertElems && inert && this[_isInert](sibling)) {
          alreadyInertElems.add(sibling);
        }
        // Should be kept inert if it's in `alreadyInertElems`.
        this[_setInert](sibling, inert || (alreadyInertElems && alreadyInertElems.has(sibling)));
      }
    }

    /**
     * Returns the list of parents of an element, starting from element (included)
     * up to `document.body` (excluded).
     * @param {!HTMLElement} element
     * @returns {Array<HTMLElement>}
     * @private
     */
    static[_getParents](element) {
      const parents = [];
      let current = element;
      // Stop to body.
      while (current && current !== document.body) {
        // Skip shadow roots.
        if (current.nodeType === Node.ELEMENT_NODE) {
          parents.push(current);
        }
        // ShadowDom v1
        if (current.assignedSlot) {
          // Collect slots from deepest slot to top.
          while ((current = current.assignedSlot)) {
            parents.push(current);
          }
          // Continue the search on the top slot.
          current = parents.pop();
          continue;
        }
        // ShadowDom v0
        const insertionPoints = current.getDestinationInsertionPoints ?
          current.getDestinationInsertionPoints() : [];
        if (insertionPoints.length) {
          for (let i = 0; i < insertionPoints.length - 1; i++) {
            parents.push(current);
          }
          // Continue the search on the top content.
          current = insertionPoints[insertionPoints.length - 1];
          continue;
        }
        current = current.parentNode || current.host;
      }
      return parents;
    }

    /**
     * Returns the distributed children of a shadow root.
     * @param {!DocumentFragment} shadowRoot
     * @returns {Set<HTMLElement>}
     * @private
     */
    static[_getDistributedChildren](shadowRoot) {
      const result = new Set();
      let i, j, nodes;
      // ShadowDom v1
      const slots = shadowRoot.querySelectorAll('slot');
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
      // ShadowDom v0
      const contents = shadowRoot.querySelectorAll('content');
      for (i = 0; i < contents.length; i++) {
        nodes = contents[i].getDistributedNodes();
        for (j = 0; j < nodes.length; j++) {
          if (nodes[j].nodeType === Node.ELEMENT_NODE) {
            result.add(nodes[j]);
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
    static[_isInert](element) {
      return element.hasAttribute('inert');
    }

    /**
     * Sets inert to an element.
     * @param {!HTMLElement} element
     * @param {boolean} inert
     * @private
     */
    static[_setInert](element, inert) {
      if (inert) {
        element.setAttribute('inert','');
      } else {
        element.removeAttribute('inert');
      }
    }
  }

  document.$blockingElements = new BlockingElements();

})(document);

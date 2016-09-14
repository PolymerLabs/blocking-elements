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

  /* Symbols for private static methods */
  const _topChanged = Symbol();
  const _setInertToSiblingsOfElement = Symbol();
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
      BlockingElements[_topChanged](null, this[_alreadyInertElements]);
      this[_blockingElements] = null;
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
      BlockingElements[_topChanged](element, this[_alreadyInertElements]);
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
        BlockingElements[_topChanged](this.top, this[_alreadyInertElements]);
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
     * and its distributed content. Pass `oldTop` to limit element updates (will look
     * for common parents and avoid setting them twice).
     * When the first blocking element is added (`newTop = null`), it saves the elements
     * that are already inert into `alreadyInertElems`. When the last blocking element
     * is removed, `alreadyInertElems` are kept inert.
     * @param {HTMLElement} newTop If null, it means the last blocking element was removed.
     * @param {!Set<HTMLElement>} alreadyInertElems Elements to be kept inert.
     * @private
     */
    static[_topChanged](newTop, alreadyInertElems) {
      const oldParents = this._topParents || [];
      const parents = newTop ? this[_getParents](newTop) : [];
      const elemsToSkip = newTop && newTop.shadowRoot ?
        this[_getDistributedChildren](newTop.shadowRoot) : null;

      let i = oldParents.length - 1;
      let j = parents.length - 1;
      // Find common parent.
      while (oldParents[i] === parents[j]) {
        i--;
        j--;
      }
      // Same parent, just switch old & new inertness.
      if (i >= 0 && j >= 0 && oldParents[i + 1] === parents[j + 1]) {
        //TODO(valdrin) update __inertedSiblings!
        this[_setInert](oldParents[i], true);
        this[_setInert](parents[j], alreadyInertElems.has(parents[j]));
        i--;
        j--;
      }
      // Reset inertness to old inerted siblings.
      let k, z;
      for (k = 0; k <= i; k++) {
        const elems = oldParents[k].__inertedSiblings;
        for (z = 0; z < elems.length; z++) {
          this[_setInert](elems[z], false);
        }
        oldParents[k].__inertedSiblings = null;
      }
      for (k = 0; k <= j; k++) {
        // Collect the already inert elements only if it is the first blocking
        // element (if oldTop = null)
        parents[k].__inertedSiblings = this[_setInertToSiblingsOfElement](parents[k], elemsToSkip,
          oldParents.length ? null : alreadyInertElems);
      }

      this._topParents = parents;

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
    static[_isNotInertable](element) {
      return /^(style|template|script|content|slot)$/.test(element.localName);
    }

    /**
     * Sets `inert` to the siblings of the element except the elements to skip.
     * be kept inert. Returns the inerted siblings.
     * @param {!HTMLElement} element
     * @param {Set<HTMLElement>} elemsToSkip
     * @param {Set<HTMLElement>} alreadyInertElems
     * @returns {Array<HTMLElement>}
     * @private
     */
    static[_setInertToSiblingsOfElement](element, elemsToSkip, alreadyInertElems) {
      const children = element.parentNode.children;
      const res = [];
      for (let i = 0; i < children.length; i++) {
        const sibling = children[i];
        // Skip the input element, if not inertable or to be skipped.
        if (sibling === element || this[_isNotInertable](sibling) ||
          (elemsToSkip && elemsToSkip.has(sibling))) {
          continue;
        }
        // Should be collected since already inerted.
        if (alreadyInertElems && this[_isInert](sibling)) {
          alreadyInertElems.add(sibling);
        } else {
          this[_setInert](sibling, true);
          res.push(sibling);
        }
      }
      return res;
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
          for (let i = 0; i < insertionPoints.length; i++) {
            parents.push(insertionPoints[i]);
          }
          // Continue the search on the top content.
          current = parents.pop();
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
    static[_isInert](element) {
      return element.inert;
    }

    /**
     * Sets inert to an element.
     * @param {!HTMLElement} element
     * @param {boolean} inert
     * @private
     */
    static[_setInert](element, inert) {
      // Prefer setting the property over the attribute since the inert spec
      // doesn't specify if it should be reflected.
      // https://html.spec.whatwg.org/multipage/interaction.html#inert
      element.inert = inert;
    }
  }

  document.$blockingElements = new BlockingElements();

})(document);

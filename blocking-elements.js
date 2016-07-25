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

  /**
   * `BlockingElements` manages a stack of elements that inert the interaction
   * outside them. The top element is the interactive part of the document.
   * The stack can be updated with the methods `push, remove, pop`.
   * @class
   */
  class BlockingElements {
    constructor() {
      /**
       * The blocking elements.
       * @type {Array<HTMLElement>}
       * @private
       */
      this._blockingElements = [];

      /**
       * Elements that are already inert before the first blocking element is pushed.
       * @type {Set<HTMLElement>}
       * @private
       */
      this._alreadyInertElements = new Set();
    }

    /**
     * Call this whenever this object is about to become obsolete. This empties
     * the blocking elements
     */
    destructor() {
      // Loop from the last to first to gradually update the tree up to body.
      for (let i = this._blockingElements.length - 1; i >= 0; i--) {
        topChanged(this._blockingElements[i - 1], this._blockingElements[i]);
      }
      delete this._blockingElements;
    }

    /**
     * A copy of the blocking elements.
     * @returns {Array<HTMLElement>}
     */
    get all() {
      return Array.prototype.slice.apply(this._blockingElements);
    }

    /**
     * The top blocking element.
     * @type {HTMLElement|null}
     */
    get top() {
      return this._blockingElements[this._blockingElements.length - 1] || null;
    }

    /**
     * Adds the element to the blocking elements.
     * @param {!HTMLElement} element
     */
    push(element) {
      const i = this._blockingElements.indexOf(element);
      // TODO(valdrin) should this element be moved to the top if already in
      // the list?
      if (i !== -1) {
        console.warn('element already added in document.blockingElements');
        return;
      }
      const oldTop = this.top;
      this._blockingElements.push(element);
      topChanged(element, oldTop, this._alreadyInertElements);
    }

    /**
     * Removes the element from the blocking elements.
     * @param {!HTMLElement} element
     */
    remove(element) {
      const i = this._blockingElements.indexOf(element);
      if (i !== -1) {
        this._blockingElements.splice(i, 1);
        // Top changed only if the removed element was the top element.
        if (i === this._blockingElements.length) {
          topChanged(this.top, element, this._alreadyInertElements);
        }
      }
    }

    /**
     * Remove the top blocking element and returns it.
     * @returns {HTMLElement|undefined} the removed element.
     */
    pop() {
      const top = this.top;
      top && this.remove(top);
      return top;
    }
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
   */
  function topChanged(newTop, oldTop, alreadyInertElems) {
    const oldElParents = oldTop ? getParents(oldTop) : [];
    const newElParents = newTop ? getParents(newTop) : [];
    const elemsToSkip = newTop && newTop.shadowRoot ? getDistributedChildren(newTop.shadowRoot) : null;
    // Loop from top to deepest elements, so we find the common parents and
    // avoid setting them twice.
    while (oldElParents.length || newElParents.length) {
      const oldElParent = oldElParents.pop();
      const newElParent = newElParents.pop();
      if (oldElParent === newElParent) {
        continue;
      }
      // Same parent, set only these 2 children.
      if (oldElParent && newElParent && oldElParent.parentNode === newElParent.parentNode) {
        if (!oldTop && oldElParent.inert) {
          alreadyInertElems.add(oldElParent);
        }
        oldElParent.inert = true;
        newElParent.inert = alreadyInertElems.has(newElParent);
      } else {
        oldElParent && setInertToSiblingsOfElement(oldElParent, false, elemsToSkip,
          alreadyInertElems);
        // Collect the already inert elements only if it is the first blocking element
        // (if oldTop = null)
        newElParent && setInertToSiblingsOfElement(newElParent, true, elemsToSkip,
          oldTop ? null : alreadyInertElems);
      }
    }
    if (!newTop) {
      alreadyInertElems.clear();
    }
  }

  /* Regex for elements that are not inertable. */
  const NOT_INERTABLE = /^(style|template|script)$/;

  /**
   * Sets `inert` to the siblings of the element except the elements to skip.
   * When `inert = true`, already inert elements are added into `alreadyInertElems`;
   * When `inert = false`, siblings that are contained in `alreadyInertElems` will
   * be kept inert.
   * @param {!HTMLElement} element
   * @param {boolean} inert
   * @param {Set<HTMLElement>} elemsToSkip
   * @param {Set<HTMLElement>} alreadyInertElems
   */
  function setInertToSiblingsOfElement(element, inert, elemsToSkip, alreadyInertElems) {
    // Previous siblings.
    let sibling = element;
    while ((sibling = sibling.previousElementSibling)) {
      // If not inertable or to be skipped, skip.
      if (NOT_INERTABLE.test(sibling.localName) ||
        (elemsToSkip && elemsToSkip.has(sibling))) {
        continue;
      }
      // Should be collected since already inerted.
      if (alreadyInertElems && inert && sibling.inert) {
        alreadyInertElems.add(sibling);
      }
      // Should be kept inert if it's in `alreadyInertElems`.
      sibling.inert = inert || (alreadyInertElems && alreadyInertElems.has(sibling));
    }
    // Next siblings.
    sibling = element;
    while ((sibling = sibling.nextElementSibling)) {
      // If not inertable or to be skipped, skip.
      if (NOT_INERTABLE.test(sibling.localName) ||
        (elemsToSkip && elemsToSkip.has(sibling))) {
        continue;
      }
      // Should be collected since already inerted.
      if (alreadyInertElems && inert && sibling.inert) {
        alreadyInertElems.add(sibling);
      }
      // Should be kept inert if it's in `alreadyInertElems`.
      sibling.inert = inert || (alreadyInertElems && alreadyInertElems.has(sibling));
    }
  }

  /**
   * Returns the list of parents of an element, starting from element (included)
   * up to `document.body` (excluded).
   * @param {!HTMLElement} element
   * @returns {Array<HTMLElement>}
   */
  function getParents(element) {
    const parents = [];
    let current = element;
    // Stop to body.
    while (current && current !== document.body) {
      let insertionPoints = [];
      // Skip shadow roots.
      if (current.nodeType === Node.ELEMENT_NODE) {
        parents.push(current);
        // From deepest to top insertion point.
        insertionPoints = [...current.getDestinationInsertionPoints()];
      }
      if (insertionPoints.length) {
        current = insertionPoints.pop();
        for (let i = 0; i < insertionPoints.length; i++) {
          parents.push(insertionPoints[i]);
        }
      } else {
        current = current.parentNode || current.host;
      }
    }
    return parents;
  }

  /**
   * Returns the distributed children of a shadow root.
   * @param {!DocumentFragment} shadowRoot
   * @returns {Set<HTMLElement>}
   */
  function getDistributedChildren(shadowRoot) {
    const result = new Set();
    // TODO(valdrin) query slots.
    [...shadowRoot.querySelectorAll('content')].forEach(function(content) {
      [...content.getDistributedNodes()].forEach(function(child) {
        (child.nodeType === Node.ELEMENT_NODE) && result.add(child);
      });
    });
    return result;
  }

  document.blockingElements = new BlockingElements();

})(document);

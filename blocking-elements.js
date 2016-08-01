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

  /* Symbols for blocking elements and already inert elements */
  const BLOCKING_ELEMS = Symbol('blockingElements');
  const ALREADY_INERT_ELEMS = Symbol('alreadyInertElements');

  /* Symbols for static methods */
  const TOP_CHANGED_FN = Symbol('topChanged');
  const NOT_INERTABLE_FN = Symbol('notInertable');
  const SET_SIBLINGS_INERT_FN = Symbol('setInertToSiblingsOfElement');
  const GET_PARENTS_FN = Symbol('getParents');
  const GET_DISTRIB_CHILDREN_FN = Symbol('getDistributedChildren');
  const IS_INERT_FN = Symbol('isInert');
  const SET_INERT_FN = Symbol('setInert');

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
      this[BLOCKING_ELEMS] = [];

      /**
       * Elements that are already inert before the first blocking element is pushed.
       * @type {Set<HTMLElement>}
       * @private
       */
      this[ALREADY_INERT_ELEMS] = new Set();
    }

    /**
     * Call this whenever this object is about to become obsolete. This empties
     * the blocking elements
     */
    destructor() {
      // Loop from the last to first to gradually update the tree up to body.
      const elems = this[BLOCKING_ELEMS];
      for (let i = elems.length - 1; i >= 0; i--) {
        BlockingElements[TOP_CHANGED_FN](elems[i - 1], elems[i], this[ALREADY_INERT_ELEMS]);
      }
      delete this[BLOCKING_ELEMS];
      delete this[ALREADY_INERT_ELEMS];
    }

    /**
     * A copy of the blocking elements.
     * @type {Array<HTMLElement>}
     */
    get all() {
      return [...this[BLOCKING_ELEMS]];
    }

    /**
     * The top blocking element.
     * @type {HTMLElement|null}
     */
    get top() {
      const elems = this[BLOCKING_ELEMS];
      return elems[elems.length - 1] || null;
    }

    /**
     * Adds the element to the blocking elements.
     * @param {!HTMLElement} element
     */
    push(element) {
      const i = this[BLOCKING_ELEMS].indexOf(element);
      // TODO(valdrin) should this element be moved to the top if already in
      // the list?
      if (i !== -1) {
        console.warn('element already added in document.blockingElements');
        return;
      }
      const oldTop = this.top;
      this[BLOCKING_ELEMS].push(element);
      BlockingElements[TOP_CHANGED_FN](element, oldTop, this[ALREADY_INERT_ELEMS]);
    }

    /**
     * Removes the element from the blocking elements.
     * @param {!HTMLElement} element
     */
    remove(element) {
      const i = this[BLOCKING_ELEMS].indexOf(element);
      if (i !== -1) {
        this[BLOCKING_ELEMS].splice(i, 1);
        // Top changed only if the removed element was the top element.
        if (i === this[BLOCKING_ELEMS].length) {
          BlockingElements[TOP_CHANGED_FN](this.top, element, this[ALREADY_INERT_ELEMS]);
        }
      }
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
    static[TOP_CHANGED_FN](newTop, oldTop, alreadyInertElems) {
      const oldElParents = oldTop ? this[GET_PARENTS_FN](oldTop) : [];
      const newElParents = newTop ? this[GET_PARENTS_FN](newTop) : [];
      const elemsToSkip = newTop && newTop.shadowRoot ?
        this[GET_DISTRIB_CHILDREN_FN](newTop.shadowRoot) : null;
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
          if (!oldTop && this[IS_INERT_FN](oldElParent)) {
            alreadyInertElems.add(oldElParent);
          }
          this[SET_INERT_FN](oldElParent, true);
          this[SET_INERT_FN](newElParent, alreadyInertElems.has(newElParent));
        } else {
          oldElParent && this[SET_SIBLINGS_INERT_FN](oldElParent, false, elemsToSkip,
            alreadyInertElems);
          // Collect the already inert elements only if it is the first blocking
          // element (if oldTop = null)
          newElParent && this[SET_SIBLINGS_INERT_FN](newElParent, true, elemsToSkip,
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
    static[NOT_INERTABLE_FN](element) {
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
    static[SET_SIBLINGS_INERT_FN](element, inert, elemsToSkip, alreadyInertElems) {
      // Previous siblings.
      let sibling = element;
      while ((sibling = sibling.previousElementSibling)) {
        // If not inertable or to be skipped, skip.
        if (this[NOT_INERTABLE_FN](sibling) || (elemsToSkip && elemsToSkip.has(sibling))) {
          continue;
        }
        // Should be collected since already inerted.
        if (alreadyInertElems && inert && this[IS_INERT_FN](sibling)) {
          alreadyInertElems.add(sibling);
        }
        // Should be kept inert if it's in `alreadyInertElems`.
        this[SET_INERT_FN](sibling, inert || (alreadyInertElems && alreadyInertElems.has(sibling)));
      }
      // Next siblings.
      sibling = element;
      while ((sibling = sibling.nextElementSibling)) {
        // If not inertable or to be skipped, skip.
        if (this[NOT_INERTABLE_FN](sibling) || (elemsToSkip && elemsToSkip.has(sibling))) {
          continue;
        }
        // Should be collected since already inerted.
        if (alreadyInertElems && inert && this[IS_INERT_FN](sibling)) {
          alreadyInertElems.add(sibling);
        }
        // Should be kept inert if it's in `alreadyInertElems`.
        this[SET_INERT_FN](sibling, inert || (alreadyInertElems && alreadyInertElems.has(sibling)));
      }
    }

    /**
     * Returns the list of parents of an element, starting from element (included)
     * up to `document.body` (excluded).
     * @param {!HTMLElement} element
     * @returns {Array<HTMLElement>}
     * @private
     */
    static[GET_PARENTS_FN](element) {
      const parents = [];
      let current = element;
      // Stop to body.
      while (current && current !== document.body) {
        let insertionPoints = [];
        // Skip shadow roots.
        if (current.nodeType === Node.ELEMENT_NODE) {
          parents.push(current);
          // From deepest to top insertion point.
          if (current.getDestinationInsertionPoints) {
            insertionPoints = [...current.getDestinationInsertionPoints()];
          }
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
     * @private
     */
    static[GET_DISTRIB_CHILDREN_FN](shadowRoot) {
      const result = new Set();
      // TODO(valdrin) query slots.
      [...shadowRoot.querySelectorAll('content')].forEach(function(content) {
        [...content.getDistributedNodes()].forEach(function(child) {
          (child.nodeType === Node.ELEMENT_NODE) && result.add(child);
        });
      });
      return result;
    }

    /**
     * Returns if an element is inert.
     * @param {!HTMLElement} element
     * @returns {boolean}
     * @private
     */
    static[IS_INERT_FN](element) {
      return element.hasAttribute('inert');
    }

    /**
     * Sets inert to an element.
     * @param {!HTMLElement} element
     * @param {boolean} inert
     * @private
     */
    static[SET_INERT_FN](element, inert) {
      // Update JS property.
      element.inert = inert;
      // Reflect to attribute.
      if (inert) {
        element.setAttribute('inert', '');
      } else {
        element.removeAttribute('inert');
      }
    }
  }

  document.$blockingElements = new BlockingElements();

})(document);

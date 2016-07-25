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

  class BlockingElements {
    constructor() {
      /**
       * The blocking elements.
       * @type {Array<HTMLElement>}
       * @private
       */
      this._blockingElements = [];
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
     * @type {HTMLElement|undefined}
     */
    get top() {
      return this._blockingElements[this._blockingElements.length - 1];
    }

    /**
     * Adds the element to the blocking elements.
     * @param {!HTMLElement} element
     */
    push(element) {
      let i = this._blockingElements.indexOf(element);
      // TODO(valdrin) should this element be moved to the top if already in
      // the list?
      if (i !== -1) {
        console.warn('element already added in document.blockingElements');
        return;
      }
      var oldTop = this.top;
      this._blockingElements.push(element);
      topChanged(element, oldTop);
    }

    /**
     * Removes the element from the blocking elements.
     * @param {!HTMLElement} element
     */
    remove(element) {
      let i = this._blockingElements.indexOf(element);
      if (i !== -1) {
        this._blockingElements.splice(i, 1);
        topChanged(this.top, element);
      }
    }

    /**
     * Remove the top blocking element and returns it.
     * @returns {HTMLElement|undefined} the removed element.
     */
    pop() {
      let top = this.top;
      top && this.remove(top);
      return top;
    }
  }

  /**
   * Sets `inert` to all document elements except the new top element, its parents,
   * and its distributed content. Pass `oldTop` to limit element updates (will look
   * for common parents and avoid setting them twice).
   * @param {HTMLElement=} newTop
   * @param {HTMLElement=} oldTop
   */
  function topChanged(newTop, oldTop) {
    let oldElParentParents = oldTop ? getParents(oldTop) : [];
    let newElParentParents = newTop ? getParents(newTop) : [];
    let elemsToSkip = newTop && newTop.shadowRoot ? getDistributedChildren(newTop.shadowRoot) : null;
    // Loop from top to deepest elements, so we find the common parents and
    // avoid setting them twice.
    while (oldElParentParents.length || newElParentParents.length) {
      let oldElParent = oldElParentParents.pop();
      let newElParent = newElParentParents.pop();
      if (oldElParent !== newElParent) {
        // Same parent, set only these 2 children.
        if (oldElParent && newElParent && oldElParent.parentNode === newElParent.parentNode) {
          oldElParent.inert = true;
          newElParent.inert = false;
        } else {
          oldElParent && setInertToSiblingsOfElement(oldElParent, false);
          newElParent && setInertToSiblingsOfElement(newElParent, true, elemsToSkip);
        }
      }
    }
  }

  /* Regex for elements that are not inertable. */
  const NOT_INERTABLE = /^(style|template|script)$/;

  /**
   * Sets `inert` to the siblings of the element except the elements to skip.
   * @param {!HTMLElement} element
   * @param {boolean} inert
   * @param {Set<Node>=} elemsToSkip
   */
  function setInertToSiblingsOfElement(element, inert, elemsToSkip) {
    let sibling = element;
    while ((sibling = sibling.previousElementSibling)) {
      if (!NOT_INERTABLE.test(sibling.localName) && (!elemsToSkip || !elemsToSkip.has(sibling))) {
        sibling.inert = inert;
      }
    }
    sibling = element;
    while ((sibling = sibling.nextElementSibling)) {
      if (!NOT_INERTABLE.test(sibling.localName) && (!elemsToSkip || !elemsToSkip.has(sibling))) {
        sibling.inert = inert;
      }
    }
  }

  /**
   * Returns the list of parents of an element, starting from elemnet (included)
   * up to `document.body` (excluded).
   * @param {!HTMLElement} element
   * @returns {Array<Node>}
   */
  function getParents(element) {
    let parents = [];
    let current = element;
    // Stop to body.
    while (current && current !== document.body) {
      // Skip shadow roots.
      if (current.nodeType === Node.ELEMENT_NODE) {
        parents.push(current);
      }
      // From deepest to top insertion point.
      const insertionPoints = current.getDestinationInsertionPoints ? [...current.getDestinationInsertionPoints()] : [];
      if (insertionPoints.length) {
        for (var i = 0; i < insertionPoints.length - 1; i++) {
          parents.push(insertionPoints[i]);
        }
        current = insertionPoints[insertionPoints.length - 1];
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
    var result = [];
    // TODO(valdrin) query slots.
    var contents = shadowRoot.querySelectorAll('content');
    for (var i = 0; i < contents.length; i++) {
      var children = contents[i].getDistributedNodes();
      for (var j = 0; j < children.length; j++) {
        if (children[j].nodeType === Node.ELEMENT_NODE) {
          result.push(children[j]);
        }
      }
    }
    return new Set(result);
  }

  document.blockingElements = new BlockingElements();

})(document);

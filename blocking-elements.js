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
       * @type {Array<Node>}
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
     * The top blocking element.
     * @type {Node|undefined}
     */
    get top() {
      return this._blockingElements[this._blockingElements.length - 1];
    }

    /**
     * Adds the node to the blocking elements.
     * @param {!Node} node
     */
    push(node) {
      let i = this._blockingElements.indexOf(node);
      // TODO(valdrin) should this element be moved to the top if already in
      // the list?
      if (i !== -1) {
        console.warn('node already added in document.blockingElements');
        return;
      }
      var oldTop = this.top;
      this._blockingElements.push(node);
      topChanged(node, oldTop);
    }

    /**
     * Removes the node from the blocking elements.
     * @param {!Node} node
     */
    remove(node) {
      let i = this._blockingElements.indexOf(node);
      if (i !== -1) {
        this._blockingElements.splice(i, 1);
        topChanged(this.top, node);
      }
    }

    /**
     * Remove the top blocking element and returns it.
     * @returns {Node|undefined} the removed node.
     */
    pop() {
      let top = this.top;
      top && this.remove(top);
      return top;
    }

    /**
     * Returns if the node is a blocking element.
     * @param {!Node} node
     * @return {boolean}
     */
    has(node) {
      return this._blockingElements.indexOf(node) !== -1;
    }
  }

  /**
   * Sets `inert` to all document nodes except the new top node, its parents,
   * and its distributed content. Pass `oldTop` to limit node updates (will look
   * for common parents and avoid setting them twice).
   * @param {Node=} newTop
   * @param {Node=} oldTop
   */
  function topChanged(newTop, oldTop) {
    let oldPath = oldTop ? getPathToBody(oldTop) : [];
    let newPath = newTop ? getPathToBody(newTop) : [];
    let nodesToSkip = newTop && newTop.shadowRoot ? getDistributedChildren(newTop.shadowRoot) : null;
    // Loop from top to deepest elements, so we find the common parents and
    // avoid setting them twice.
    while (oldPath.length || newPath.length) {
      let oldEl = oldPath.pop();
      let newEl = newPath.pop();
      if (oldEl !== newEl) {
        // Same parent, set only these 2 children.
        if (oldEl && newEl && oldEl.parentNode === newEl.parentNode) {
          oldEl.inert = true;
          newEl.inert = false;
        } else {
          oldEl && setInertToSiblingsOfNode(oldEl, false);
          newEl && setInertToSiblingsOfNode(newEl, true, nodesToSkip);
        }
      }
    }
  }

  /* Regex for elements that are not inertable. */
  const NOT_INERTABLE = /^(style|template|script)$/;

  /**
   * Sets `inert` to the siblings of the node except the nodes to skip.
   * @param {!Node} node
   * @param {boolean} inert
   * @param {Set<Node>=} nodesToSkip
   */
  function setInertToSiblingsOfNode(node, inert, nodesToSkip) {
    let sibling = node;
    while ((sibling = sibling.previousElementSibling)) {
      if (!NOT_INERTABLE.test(sibling.localName) && (!nodesToSkip || !nodesToSkip.has(sibling))) {
        sibling.inert = inert;
      }
    }
    sibling = node;
    while ((sibling = sibling.nextElementSibling)) {
      if (!NOT_INERTABLE.test(sibling.localName) && (!nodesToSkip || !nodesToSkip.has(sibling))) {
        sibling.inert = inert;
      }
    }
  }

  /**
   * Returns the list of parents, shadowRoots and insertion points, starting from
   * node up to `document.body` (excluded).
   * @param {!Node} node
   * @returns {Array<Node>}
   */
  function getPathToBody(node) {
    let path = [];
    let current = node;
    // Stop to body.
    while (current && current !== document.body) {
      path.push(current);
      // From deepest to top insertion point.
      const insertionPoints = current.getDestinationInsertionPoints ? [...current.getDestinationInsertionPoints()] : [];
      if (insertionPoints.length) {
        for (var i = 0; i < insertionPoints.length - 1; i++) {
          path.push(insertionPoints[i]);
        }
        current = insertionPoints[insertionPoints.length - 1];
      } else {
        current = current.parentNode || current.host;
      }
    }
    return path;
  }

  /**
   * Returns the distributed children of a shadow root.
   * @param {!DocumentFragment} shadowRoot
   * @returns {Set<Node>}
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

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
       */
      this._blockingElements = [];
    }

    /**
     * Call this whenever this object is about to become obsolete. This empties
     * the blocking elements
     */
    destructor() {
      for (let i = 0; i < this._blockingElements.length; i++)
        inertSiblings(this._blockingElements[i], false);
      delete this._blockingElements;
    }

    /**
     * @return {Node|undefined} The top blocking element.
     */
    get top() {
      return this._blockingElements[this._blockingElements.length - 1];
    }

    /**
     * @param {!Node} startNode
     */
    push(node) {
      let i = this._blockingElements.indexOf(node);
      // TODO(valdrin) should this element be moved to the top if already in
      // the list?
      if (i !== -1) {
        return;
      }
      this._blockingElements.push(node);
      inertSiblings(node, true, getDistributedChildren(node));
    }

    /**
     * @param {!Node} node
     */
    remove(node) {
      let i = this._blockingElements.indexOf(node);
      if (i !== -1) {
        this._blockingElements.splice(i, 1);
        inertSiblings(node, false);
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

    has(node) {
      return this._blockingElements.indexOf(node) !== -1;
    }
  }


  /**
   * Inerts all the siblings of the node Set all nodes to inert except the node
   * and the nodes to skip.
   * @param {Node} node
   * @param {boolean} inert
   * @param {Set<Node>=} nodesToSkip
   */
  function inertSiblings(node, inert, nodesToSkip) {
    let sibling = node;
    while ((sibling = sibling.previousElementSibling)) {
      sibling.inert = inert && (!nodesToSkip ||!nodesToSkip.has(sibling));
    }
    sibling = node;
    while ((sibling = sibling.nextElementSibling)) {
      sibling.inert = inert && (!nodesToSkip ||!nodesToSkip.has(sibling))
    }
    let parent = node.parentNode || node.host;
    if (parent && parent !== document.body) {
      inertSiblings(parent, inert, nodesToSkip);
    }
  }


  function getDistributedChildren(node) {
    if (!node.shadowRoot) {
      return;
    }
    var result = [];
    // TODO(valdrin) query slots.
    var contents = node.shadowRoot.querySelectorAll('content');
    for (var i = 0; i < contents.length; i++) {
      var children = contents[i].getDistributedNodes();
      for (var j = 0; j < children.length; j++) {
        // No #text nodes.
        if (children[j].nodeType !== 3) {
          result.push(children[j]);
        }
      }
    }
    return new Set(result);
  }

  document.blockingElements = new BlockingElements();

})(document);

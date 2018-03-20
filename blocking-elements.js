/**
 * @license
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
  const _topElParents = Symbol();
  const _siblingsToRestore = Symbol();
  const _parentMO = Symbol();

  /* Symbols for private static methods */
  const _topChanged = Symbol();
  const _swapInertedSibling = Symbol();
  const _inertSiblings = Symbol();
  const _restoreInertedSiblings = Symbol();
  const _getParents = Symbol();
  const _getDistributedChildren = Symbol();
  const _isInertable = Symbol();
  const _handleMutations = Symbol();

  /**
   * `BlockingElements` manages a stack of elements that inert the interaction
   * outside them. The top element is the interactive part of the document.
   * The stack can be updated with the methods `push, remove, pop`.
   */
  class BlockingElements {
    /**
     * New BlockingElements instance.
     */
    constructor() {
      /**
       * The blocking elements.
       * @type {Array<HTMLElement>}
       * @private
       */
      this[_blockingElements] = [];

      /**
       * Used to keep track of the parents of the top element, from the element
       * itself up to body. When top changes, the old top might have been removed
       * from the document, so we need to memoize the inerted parents' siblings
       * in order to restore their inerteness when top changes.
       * @type {Array<HTMLElement>}
       * @private
       */
      this[_topElParents] = [];

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
      this[_restoreInertedSiblings](this[_topElParents]);
      this[_blockingElements] = null;
      this[_topElParents] = null;
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
      if (!element || element === this.top) {
        return;
      }
      // Remove it from the stack, we'll bring it to the top.
      this.remove(element);
      this[_topChanged](element);
      this[_blockingElements].push(element);
    }

    /**
     * Removes the element from the blocking elements. Returns true if the element
     * was removed.
     * @param {!HTMLElement} element
     * @return {boolean}
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
     * @return {HTMLElement|null} the removed element.
     */
    pop() {
      const top = this.top;
      top && this.remove(top);
      return top;
    }

    /**
     * Returns if the element is a blocking element.
     * @param {!HTMLElement} element
     * @return {boolean}
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
      const toKeepInert = this[_alreadyInertElements];
      const oldParents = this[_topElParents];
      // No new top, reset old top if any.
      if (!newTop) {
        this[_restoreInertedSiblings](oldParents);
        toKeepInert.clear();
        this[_topElParents] = [];
        return;
      }

      const newParents = this[_getParents](newTop);
      // New top is not contained in the main document!
      if (newParents[newParents.length - 1].parentNode !== document.body) {
        throw Error('Non-connected element cannot be a blocking element');
      }
      this[_topElParents] = newParents;

      const toSkip = this[_getDistributedChildren](newTop);

      // No previous top element.
      if (!oldParents.length) {
        this[_inertSiblings](newParents, toSkip, toKeepInert);
        return;
      }

      let i = oldParents.length - 1;
      let j = newParents.length - 1;
      // Find common parent. Index 0 is the element itself (so stop before it).
      while (i > 0 && j > 0 && oldParents[i] === newParents[j]) {
        i--;
        j--;
      }
      // If up the parents tree there are 2 elements that are siblings, swap
      // the inerted sibling.
      if (oldParents[i] !== newParents[j]) {
        this[_swapInertedSibling](oldParents[i], newParents[j]);
      }
      // Restore old parents siblings inertness.
      i > 0 && this[_restoreInertedSiblings](oldParents.slice(0, i));
      // Make new parents siblings inert.
      j > 0 && this[_inertSiblings](newParents.slice(0, j), toSkip);
    }

    /**
     * Swaps inertness between two sibling elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     * @param {!HTMLElement} oldInert
     * @param {!HTMLElement} newInert
     * @private
     */
    [_swapInertedSibling](oldInert, newInert) {
      const siblingsToRestore = oldInert[_siblingsToRestore];
      // oldInert is not contained in siblings to restore, so we have to check
      // if it's inertable and if already inert.
      if (this[_isInertable](oldInert) && !oldInert.inert) {
        oldInert.inert = true;
        siblingsToRestore.add(oldInert);
      }
      // If newInert was already between the siblings to restore, it means it is
      // inertable and must be restored.
      if (siblingsToRestore.has(newInert)) {
        newInert.inert = false;
        siblingsToRestore.delete(newInert);
      }
      newInert[_parentMO] = oldInert[_parentMO];
      oldInert[_parentMO] = null;
      newInert[_siblingsToRestore] = siblingsToRestore;
      oldInert[_siblingsToRestore] = null;
    }

    /**
     * Restores original inertness to the siblings of the elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     * @param {!Array<HTMLElement>} elements
     * @private
     */
    [_restoreInertedSiblings](elements) {
      elements.forEach((el) => {
        el[_parentMO].disconnect();
        el[_parentMO] = null;
        for (let sibling of el[_siblingsToRestore]) {
          sibling.inert = false;
        }
        el[_siblingsToRestore] = null;
      });
    }

    /**
     * Inerts the siblings of the elements except the elements to skip. Stores
     * the inerted siblings into the element's symbol `_siblingsToRestore`.
     * Pass `toKeepInert` to collect the already inert elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     * @param {!Array<HTMLElement>} elements
     * @param {Set<HTMLElement>} toSkip
     * @param {Set<HTMLElement>} toKeepInert
     * @private
     */
    [_inertSiblings](elements, toSkip, toKeepInert) {
      for (let i = 0, l = elements.length; i < l; i++) {
        const element = elements[i];
        const children = element.parentNode.children;
        const inertedSiblings = new Set();
        for (let j = 0; j < children.length; j++) {
          const sibling = children[j];
          // Skip the input element, if not inertable or to be skipped.
          if (sibling === element || !this[_isInertable](sibling) ||
            (toSkip && toSkip.has(sibling))) {
            continue;
          }
          // Should be collected since already inerted.
          if (toKeepInert && sibling.inert) {
            toKeepInert.add(sibling);
          } else {
            sibling.inert = true;
            inertedSiblings.add(sibling);
          }
        }
        // Store the siblings that were inerted.
        element[_siblingsToRestore] = inertedSiblings;
        // Observe only immediate children mutations on the parent.
        element[_parentMO] = new MutationObserver(this[_handleMutations].bind(this));
        element[_parentMO].observe(element.parentNode, {
          childList: true,
        });
      }
    }

    /**
     * Handles newly added/removed nodes by toggling their inertness.
     * It also checks if the current top Blocking Element has been removed,
     * notifying and removing it.
     * @param {Array<MutationRecord>} mutations
     * @private
     */
    [_handleMutations](mutations) {
      const parents = this[_topElParents];
      const toKeepInert = this[_alreadyInertElements];
      for (const mutation of mutations) {
        const idx = mutation.target === document.body ?
          parents.length :
          parents.indexOf(mutation.target);
        const inertedChild = parents[idx - 1];
        const inertedSiblings = inertedChild[_siblingsToRestore];

        // To restore.
        for (const sibling of mutation.removedNodes) {
          if (sibling === inertedChild) {
            console.info('Detected removal of the top Blocking Element.');
            this.pop();
            return;
          }
          if (inertedSiblings.has(sibling)) {
            sibling.inert = false;
            inertedSiblings.delete(sibling);
          }
        }

        // To inert.
        for (const sibling of mutation.addedNodes) {
          if (!this[_isInertable](sibling)) {
            continue;
          }
          if (toKeepInert && sibling.inert) {
            toKeepInert.add(sibling);
          } else {
            sibling.inert = true;
            inertedSiblings.add(sibling);
          }
        }
      }
    }

    /**
     * Returns if the element is inertable.
     * @param {!HTMLElement} element
     * @return {boolean}
     * @private
     */
    [_isInertable](element) {
      return false === /^(style|template|script)$/.test(element.localName);
    }

    /**
     * Returns the list of newParents of an element, starting from element (included)
     * up to `document.body` (excluded).
     * @param {HTMLElement} element
     * @return {Array<HTMLElement>}
     * @private
     */
    [_getParents](element) {
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
     * Returns the distributed children of the element's shadow root.
     * Returns null if the element doesn't have a shadow root.
     * @param {!element} element
     * @return {Set<HTMLElement>|null}
     * @private
     */
    [_getDistributedChildren](element) {
      const shadowRoot = element.shadowRoot;
      if (!shadowRoot) {
        return null;
      }
      const result = new Set();
      let i;
      let j;
      let nodes;
      // ShadowDom v1
      const slots = shadowRoot.querySelectorAll('slot');
      if (slots.length && slots[0].assignedNodes) {
        for (i = 0; i < slots.length; i++) {
          nodes = slots[i].assignedNodes({
            flatten: true,
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
  }

  document.$blockingElements = new BlockingElements();
})(document);

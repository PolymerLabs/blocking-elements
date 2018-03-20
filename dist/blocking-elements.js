(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(factory());
}(this, (function () { 'use strict';

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

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

(function (document) {
  /* Symbols for private properties */
  var _blockingElements = Symbol();
  var _alreadyInertElements = Symbol();
  var _topElParents = Symbol();
  var _siblingsToRestore = Symbol();
  var _parentMO = Symbol();

  /* Symbols for private static methods */
  var _topChanged = Symbol();
  var _swapInertedSibling = Symbol();
  var _inertSiblings = Symbol();
  var _restoreInertedSiblings = Symbol();
  var _getParents = Symbol();
  var _getDistributedChildren = Symbol();
  var _isInertable = Symbol();
  var _handleMutations = Symbol();

  /**
   * `BlockingElements` manages a stack of elements that inert the interaction
   * outside them. The top element is the interactive part of the document.
   * The stack can be updated with the methods `push, remove, pop`.
   */

  var BlockingElements = function () {
    /**
     * New BlockingElements instance.
     */
    function BlockingElements() {
      classCallCheck(this, BlockingElements);

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


    createClass(BlockingElements, [{
      key: 'destructor',
      value: function destructor() {
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

    }, {
      key: 'push',


      /**
       * Adds the element to the blocking elements.
       * @param {!HTMLElement} element
       */
      value: function push(element) {
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

    }, {
      key: 'remove',
      value: function remove(element) {
        var i = this[_blockingElements].indexOf(element);
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

    }, {
      key: 'pop',
      value: function pop() {
        var top = this.top;
        top && this.remove(top);
        return top;
      }

      /**
       * Returns if the element is a blocking element.
       * @param {!HTMLElement} element
       * @return {boolean}
       */

    }, {
      key: 'has',
      value: function has(element) {
        return this[_blockingElements].indexOf(element) !== -1;
      }

      /**
       * Sets `inert` to all document elements except the new top element, its parents,
       * and its distributed content.
       * @param {?HTMLElement} newTop If null, it means the last blocking element was removed.
       * @private
       */

    }, {
      key: _topChanged,
      value: function value(newTop) {
        var toKeepInert = this[_alreadyInertElements];
        var oldParents = this[_topElParents];
        // No new top, reset old top if any.
        if (!newTop) {
          this[_restoreInertedSiblings](oldParents);
          toKeepInert.clear();
          this[_topElParents] = [];
          return;
        }

        var newParents = this[_getParents](newTop);
        // New top is not contained in the main document!
        if (newParents[newParents.length - 1].parentNode !== document.body) {
          throw Error('Non-connected element cannot be a blocking element');
        }
        this[_topElParents] = newParents;

        var toSkip = this[_getDistributedChildren](newTop);

        // No previous top element.
        if (!oldParents.length) {
          this[_inertSiblings](newParents, toSkip, toKeepInert);
          return;
        }

        var i = oldParents.length - 1;
        var j = newParents.length - 1;
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

    }, {
      key: _swapInertedSibling,
      value: function value(oldInert, newInert) {
        var siblingsToRestore = oldInert[_siblingsToRestore];
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

    }, {
      key: _restoreInertedSiblings,
      value: function value(elements) {
        elements.forEach(function (el) {
          el[_parentMO].disconnect();
          el[_parentMO] = null;
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = el[_siblingsToRestore][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var sibling = _step.value;

              sibling.inert = false;
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
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

    }, {
      key: _inertSiblings,
      value: function value(elements, toSkip, toKeepInert) {
        for (var i = 0, l = elements.length; i < l; i++) {
          var element = elements[i];
          var children = element.parentNode.children;
          var inertedSiblings = new Set();
          for (var j = 0; j < children.length; j++) {
            var sibling = children[j];
            // Skip the input element, if not inertable or to be skipped.
            if (sibling === element || !this[_isInertable](sibling) || toSkip && toSkip.has(sibling)) {
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
            childList: true
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

    }, {
      key: _handleMutations,
      value: function value(mutations) {
        var parents = this[_topElParents];
        var toKeepInert = this[_alreadyInertElements];
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = mutations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var mutation = _step2.value;

            var idx = mutation.target === document.body ? parents.length : parents.indexOf(mutation.target);
            var inertedChild = parents[idx - 1];
            var inertedSiblings = inertedChild[_siblingsToRestore];

            // To restore.
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = mutation.removedNodes[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var sibling = _step3.value;

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
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                  _iterator3.return();
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
                }
              }
            }

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
              for (var _iterator4 = mutation.addedNodes[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                var _sibling = _step4.value;

                if (!this[_isInertable](_sibling)) {
                  continue;
                }
                if (toKeepInert && _sibling.inert) {
                  toKeepInert.add(_sibling);
                } else {
                  _sibling.inert = true;
                  inertedSiblings.add(_sibling);
                }
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
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

    }, {
      key: _isInertable,
      value: function value(element) {
        return false === /^(style|template|script)$/.test(element.localName);
      }

      /**
       * Returns the list of newParents of an element, starting from element (included)
       * up to `document.body` (excluded).
       * @param {HTMLElement} element
       * @return {Array<HTMLElement>}
       * @private
       */

    }, {
      key: _getParents,
      value: function value(element) {
        var parents = [];
        var current = element;
        // Stop to body.
        while (current && current !== document.body) {
          // Skip shadow roots.
          if (current.nodeType === Node.ELEMENT_NODE) {
            parents.push(current);
          }
          // ShadowDom v1
          if (current.assignedSlot) {
            // Collect slots from deepest slot to top.
            while (current = current.assignedSlot) {
              parents.push(current);
            }
            // Continue the search on the top slot.
            current = parents.pop();
            continue;
          }
          // ShadowDom v0
          var insertionPoints = current.getDestinationInsertionPoints ? current.getDestinationInsertionPoints() : [];
          if (insertionPoints.length) {
            for (var i = 0; i < insertionPoints.length; i++) {
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

    }, {
      key: _getDistributedChildren,
      value: function value(element) {
        var shadowRoot = element.shadowRoot;
        if (!shadowRoot) {
          return null;
        }
        var result = new Set();
        var i = void 0;
        var j = void 0;
        var nodes = void 0;
        // ShadowDom v1
        var slots = shadowRoot.querySelectorAll('slot');
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
        var contents = shadowRoot.querySelectorAll('content');
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
    }, {
      key: 'top',
      get: function get$$1() {
        var elems = this[_blockingElements];
        return elems[elems.length - 1] || null;
      }
    }]);
    return BlockingElements;
  }();

  document.$blockingElements = new BlockingElements();
})(document);

})));

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
declare const _blockingElements: unique symbol;
declare const _alreadyInertElements: unique symbol;
declare const _topElParents: unique symbol;
/**
 * Standard Document interface with the Blocking Elements polyfill.
 */
export interface DocumentWithBlockingElements extends Document {
    $blockingElements: BlockingElements;
}
/**
 * `BlockingElements` manages a stack of elements that inert the interaction
 * outside them. The top element is the interactive part of the document.
 * The stack can be updated with the methods `push, remove, pop`.
 */
declare class BlockingElements {
    /**
     * The blocking elements.
     */
    private [_blockingElements];
    /**
     * Used to keep track of the parents of the top element, from the element
     * itself up to body. When top changes, the old top might have been removed
     * from the document, so we need to memoize the inerted parents' siblings
     * in order to restore their inerteness when top changes.
     */
    private [_topElParents];
    /**
     * Elements that are already inert before the first blocking element is
     * pushed.
     */
    private [_alreadyInertElements];
    /**
     * Call this whenever this object is about to become obsolete. This empties
     * the blocking elements
     */
    destructor(): void;
    /**
     * The top blocking element.
     */
    readonly top: HTMLElement | null;
    /**
     * Adds the element to the blocking elements.
     */
    push(element: HTMLElement): HTMLElement | undefined;
    /**
     * Removes the element from the blocking elements. Returns true if the element
     * was removed.
     */
    remove(element: HTMLElement): boolean;
    /**
     * Remove the top blocking element and returns it.
     */
    pop(): HTMLElement | null;
    /**
     * Returns if the element is a blocking element.
     */
    has(element: HTMLElement): boolean;
    /**
     * Sets `inert` to all document elements except the new top element, its
     * parents, and its distributed content.
     */
    private [_topChanged];
    /**
     * Swaps inertness between two sibling elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     */
    private [_swapInertedSibling];
    /**
     * Restores original inertness to the siblings of the elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     */
    private [_restoreInertedSiblings];
    /**
     * Inerts the siblings of the elements except the elements to skip. Stores
     * the inerted siblings into the element's symbol `_siblingsToRestore`.
     * Pass `toKeepInert` to collect the already inert elements.
     * Sets the property `inert` over the attribute since the inert spec
     * doesn't specify if it should be reflected.
     * https://html.spec.whatwg.org/multipage/interaction.html#inert
     */
    private [_inertSiblings];
    /**
     * Handles newly added/removed nodes by toggling their inertness.
     * It also checks if the current top Blocking Element has been removed,
     * notifying and removing it.
     */
    private [_handleMutations];
    /**
     * Returns if the element is inertable.
     */
    private [_isInertable];
    /**
     * Returns the list of newParents of an element, starting from element
     * (included) up to `document.body` (excluded).
     */
    private [_getParents];
    /**
     * Returns the distributed children of the element's shadow root.
     * Returns null if the element doesn't have a shadow root.
     */
    private [_getDistributedChildren];
}
export {};

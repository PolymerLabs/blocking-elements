# `blockingElements` stack API

Implementation of proposal <https://github.com/whatwg/html/issues/897>

`document.$blockingElements` manages a stack of elements that inert the interaction outside them.

- the stack can be updated with the methods `push(elem), remove(elem), pop(elem)`
- the top element (`document.$blockingElements.top`) is the interactive part of the document
- `has(elem)` returns if the element is a blocking element

This polyfill will:

- search for the path of the element to block up to `document.body`
- set `inert` to all the siblings of each parent, skipping the parents and the element's distributed content (if any)

Use this polyfill together with the [WICG/inert](https://github.com/WICG/inert) polyfill to disable interactions on the rest of the document. See the [demo page]() as an example.

## Why not listening to events that trigger focus change?

Another approach could be to listen for events that trigger focus change (e.g. `focus, blur, keydown`) and prevent those if focus moves out of the blocking element.

Wrapping the focus requires to find all the focusable nodes within the top blocking element, eventually sort by tabindex, in order to find first and last focusable node.

This approach doesn't allow the focus to move outside the window (e.g. to the browser's url bar, dev console if opened, etc.), and is less robust when used with assistive technology (e.g. android talkback allows to move focus with swipe on screen, Apple Voiceover allows to move focus with special keyboard combinations).

## Performance

Performance is dependent on the `inert` polyfill performance. The polyfill tries to invoke `inert` only if strictly needed (e.g. avoid setting it twice when updating the top blocking element).

At each toggle, scripting + rendering + painting totals to **~50ms** (first toggle), **~35ms** (next toggles)

The heaviest parts are:

- unconditional paint caused by changes to `cursor-event` css property (see [issue](https://github.com/WICG/inert/issues/21)) => once fixed we should gain **~20-25ms**
- addition of the inert style nodes in shadow roots (done once for inert element's shadow root, see [polyfill's implementation](https://github.com/WICG/inert/blob/master/inert.js#L581)) => can be fixed only by native implementation of `inert`, should be a gain of at least **~5ms** (cost of adding a node)

The results have been obtained by toggling the deepest `x-trap-focus` inside nested `x-b` (Chrome v52 stable for MacOs -> <http://localhost:8080/components/blockingElements/demo/ce.html?ce=v0>) ![results](https://cloud.githubusercontent.com/assets/6173664/17538133/914f365a-5e57-11e6-9b91-1c6b7eb22d57.png)

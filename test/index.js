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
const assert = chai.assert;
const fixture = new Fixture();

function emptyBlockingElements() {
  while (document.$blockingElements.pop()) {
    // keep popping!
  }
}

describe('Basic', function() {
  let outer;
  beforeEach(function(done) {
    fixture.load('fixtures/basic.html', function() {
      outer = document.getElementById('fixture');
      done();
    });
  });

  afterEach(function() {
    // empty blocking elements
    emptyBlockingElements();
    fixture.destroy();
  });

  it('push() adds an element to the stack, remove() removes it', function() {
    const child = outer.children[0];
    assert.equal(document.$blockingElements.all.length, 0);
    document.$blockingElements.push(child);
    assert.equal(document.$blockingElements.all.length, 1);
    assert.equal(document.$blockingElements.top, child);

    document.$blockingElements.remove(child);
    assert.equal(document.$blockingElements.all.length, 0);
  });

  it('pop() removes the top blocking element from stack and returns it', function() {
    document.$blockingElements.push(outer.children[0]);
    document.$blockingElements.push(outer.children[1]);
    assert.equal(document.$blockingElements.all.length, 2);
    assert.equal(document.$blockingElements.top, outer.children[1], '2nd child is top blocking element');
    assert.equal(document.$blockingElements.pop(), outer.children[1], '2nd child removed');
    assert.equal(document.$blockingElements.all.length, 1);
  });

  it('preserve already inert elements', function() {
    assert.equal(document.$blockingElements.all.length, 0);
    const child = outer.children[0];
    // Make children[1] inert
    outer.children[1].setAttribute('inert', '');
    // Push and remove children[0], see if inert is preserved.
    document.$blockingElements.push(child);
    assert.equal(document.$blockingElements.all.length, 1);
    document.$blockingElements.remove(child);
    assert.equal(document.$blockingElements.all.length, 0);
    assert.isTrue(outer.children[1].hasAttribute('inert'), 'inert preserved');
  });

  it('multiple push() update elements inertness', function() {
    document.$blockingElements.push(outer.children[0]);
    assert.equal(document.$blockingElements.all.length, 1);
    assert.equal(document.$blockingElements.top, outer.children[0]);
    assert.equal(outer.children[0].inert, false, '1st child active');
    assert.equal(outer.children[1].inert, true, '2nd child inert');
    assert.equal(outer.children[2].inert, true, '3rd child inert');

    document.$blockingElements.push(outer.children[1]);
    assert.equal(document.$blockingElements.all.length, 2);
    assert.equal(document.$blockingElements.top, outer.children[1]);
    assert.equal(outer.children[0].inert, true, '1st child inert');
    assert.equal(outer.children[1].inert, false, '2nd child active');
    assert.equal(outer.children[2].inert, true, '3rd child inert');
  });

  it('update elements in shadow dom', function() {
    if (!outer.attachShadow) {
      console.log('test skipped because Shadow DOM is not supported by the browser');
      return;
    }
    // Prepare template with a button and distributed content.
    const t = document.createElement('template');
    t.content.appendChild(document.createElement('button'));
    t.content.appendChild(document.createElement('slot'));

    // Create shadow root for fixture, add template.
    const root = outer.attachShadow({
      mode: 'open'
    });
    const clone = document.importNode(t.content, true);
    root.appendChild(clone);

    const shadowBtn = root.querySelector('button');

    // Distributed element as a blocking element.
    document.$blockingElements.push(outer.children[0]);
    assert.equal(document.$blockingElements.all.length, 1);
    assert.equal(document.$blockingElements.top, outer.children[0]);
    assert.equal(shadowBtn.inert, true, 'button in shadow dom inert');
    assert.equal(outer.children[0].inert, false, '1st child active');
    assert.equal(outer.children[1].inert, true, '2nd child inert');
    assert.equal(outer.children[2].inert, true, '3rd child inert');

    // Button in shadow dom as a blocking element, its siblings should be inert
    document.$blockingElements.push(shadowBtn);
    assert.equal(document.$blockingElements.all.length, 2);
    assert.equal(document.$blockingElements.top, shadowBtn);
    assert.equal(shadowBtn.inert, false, 'button in shadow dom active');
    assert.equal(shadowBtn.nextElementSibling.inert, true, 'button sibling (slot) inert');
    assert.equal(outer.children[0].inert, false, '1st child inert restored');
    assert.equal(outer.children[1].inert, false, '2nd child inert restored');
    assert.equal(outer.children[2].inert, false, '3rd child inert restored');
  });
});

describe('Nested', function() {
  let outer, inner;
  beforeEach(function(done) {
    fixture.load('fixtures/nested.html', function() {
      outer = document.getElementById('fixture');
      inner = document.getElementById('inner');
      done();
    });
  });

  afterEach(function() {
    fixture.destroy();
    // empty blocking elements
    emptyBlockingElements();
  });

  it('push() keeps parent tree active', function() {
    assert.equal(document.$blockingElements.all.length, 0);
    document.$blockingElements.push(inner.children[0]);
    assert.equal(document.$blockingElements.all.length, 1);
    assert.equal(document.$blockingElements.top, inner.children[0]);

    // node and its parents should be active
    assert.equal(inner.children[0].inert, false, 'inner child active');
    assert.equal(inner.inert, false, 'inner active');

    // Its siblings and parent's siblings should be inert.
    for (var i = 1; i < inner.children.length; i++) {
      assert.equal(inner.children[i].inert, true, 'inner sibling inert');
    }
    assert.equal(outer.children[0].inert, true, '1st child inert');
    assert.equal(outer.children[1].inert, true, '2nd child inert');
    assert.equal(outer.children[2].inert, true, '3rd child inert');
  });

});

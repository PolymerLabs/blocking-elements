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
(function() {
  var assert = chai.assert;
  var fixtureLoader = new Fixture();
  /* eslint-disable require-jsdoc */

  function emptyBlockingElements() {
    while (document.$blockingElements.pop()) {
      // keep popping!
    }
  }

  describe('basic', function() {
    var container;

    beforeEach(function() {
      assert.equal(document.$blockingElements.top, null);
      container = fixtureLoader.load(`
      <div>
        <button>button</button>
        <button>button</button>
        <button>button</button>
      </div>`);
    });

    afterEach(function() {
      emptyBlockingElements();
      fixtureLoader.destroy();
    });

    it('document.$blockingElements is defined', function() {
      assert.isOk(document.$blockingElements);
    });

    it('push() adds an element to the stack, remove() removes it', function() {
      var child = container.children[0];
      document.$blockingElements.push(child);
      assert.equal(document.$blockingElements.top, child);

      document.$blockingElements.remove(child);
      assert.equal(document.$blockingElements.top, null);
    });

    it('push() can be used to make an already blocking element the top blocking element',
      function() {
        document.$blockingElements.push(container.children[0]);
        assert.equal(document.$blockingElements.top, container.children[0],
          'child0 is top blocking element');
        // Add another element.
        document.$blockingElements.push(container.children[1]);
        assert.equal(document.$blockingElements.top, container.children[1],
          'child1 is top blocking element');
        // Push again first element.
        document.$blockingElements.push(container.children[0]);
        assert.equal(document.$blockingElements.top, container.children[0],
          'child0 brought to top');
      });

    it('push() adds only elements contained in document', function() {
      assert.throws(function() {
        document.$blockingElements.push(document.createElement('div'));
      }, 'Non-connected element cannot be a blocking element');
      assert.equal(document.$blockingElements.top, null, 'element is not a blocking element');
    });

    it('pop() removes the top blocking element from stack and returns it', function() {
      document.$blockingElements.push(container.children[0]);
      document.$blockingElements.push(container.children[1]);
      assert.isTrue(document.$blockingElements.has(container.children[0]),
        '1st child is a blocking element');
      assert.equal(document.$blockingElements.top, container.children[1],
        '2nd child is top blocking element');
      assert.equal(document.$blockingElements.pop(), container.children[1],
        '2nd child removed');
      assert.equal(document.$blockingElements.top, container.children[0],
        '1sd child is top blocking element');
    });

    it('preserve already inert elements', function() {
      var child = container.children[0];
      // Make children[1] inert
      container.children[1].inert = true;
      // Push and remove children[0], see if inert is preserved.
      document.$blockingElements.push(child);
      assert.equal(document.$blockingElements.top, child);
      document.$blockingElements.remove(child);
      assert.equal(document.$blockingElements.top, null);
      assert.isTrue(container.children[1].inert, 'inert preserved');
    });

    it('multiple push() update elements inertness', function() {
      document.$blockingElements.push(container.children[0]);
      assert.equal(document.$blockingElements.top, container.children[0]);
      assert.isNotOk(container.children[0].inert, '1st child active');
      assert.isTrue(container.children[1].inert, '2nd child inert');
      assert.isTrue(container.children[2].inert, '3rd child inert');

      document.$blockingElements.push(container.children[1]);
      assert.isTrue(document.$blockingElements.has(container.children[0]),
        '1st child is a blocking element');
      assert.equal(document.$blockingElements.top, container.children[1],
        '2nd child is top blocking element');
      assert.isTrue(container.children[0].inert, '1st child inert');
      assert.isNotOk(container.children[1].inert, '2nd child active');
      assert.isTrue(container.children[2].inert, '3rd child inert');
    });

    it('remove() handles elements not in the dom anymore', function() {
      var child = container.children[0];
      document.$blockingElements.push(child);
      assert.equal(document.$blockingElements.top, child);
      container.removeChild(child);
      document.$blockingElements.remove(child);
      assert.equal(document.$blockingElements.top, null);
      assert.isNotOk(container.inert, 'container active');
      // Remaining children should be active.
      for (var i = 0; i < container.children.length; i++) {
        assert.isNotOk(container.children[i].inert, 'sibling active');
      }
    });

    it('destructor resets the document inertness', function() {
      document.$blockingElements.push(container.children[0]);
      // Destroy and then construct again.
      document.$blockingElements.destructor();
      document.$blockingElements = new document.$blockingElements.constructor();
      assert.isNotOk(container.inert, 'container active');
      // Remaining children should be active.
      for (var i = 0; i < container.children.length; i++) {
        assert.isNotOk(container.children[i].inert, 'sibling active');
      }
    });
  });

  describe('nested', function() {
    var container;
    var inner;

    beforeEach(function() {
      assert.equal(document.$blockingElements.top, null);
      container = fixtureLoader.load(`
        <div>
          <button>button</button>
          <button>button</button>
          <button>button</button>
          <div id="inner">
            <button>button</button>
            <button>button</button>
            <button>button</button>
          </div>
        </div>`);
      inner = container.querySelector('#inner');
    });

    afterEach(function() {
      emptyBlockingElements();
      fixtureLoader.destroy();
    });

    it('push() keeps parent tree active', function() {
      document.$blockingElements.push(inner.children[0]);
      assert.equal(document.$blockingElements.top, inner.children[0]);

      // node and its parents should be active
      assert.isNotOk(inner.children[0].inert, 'inner child active');
      assert.isNotOk(inner.inert, 'inner active');

      // Its siblings and parent's siblings should be inert.
      for (var i = 1; i < inner.children.length; i++) {
        assert.isTrue(inner.children[i].inert, 'inner sibling inert');
      }
      assert.isTrue(container.children[0].inert, '1st child inert');
      assert.isTrue(container.children[1].inert, '2nd child inert');
      assert.isTrue(container.children[2].inert, '3rd child inert');
    });
  });

  describe('mutations', function() {
    var container;

    beforeEach(function() {
      assert.equal(document.$blockingElements.top, null);
      container = fixtureLoader.load(`
        <div>
          <button>button</button>
          <button>button</button>
          <button>button</button>
        </div>`);
    });

    afterEach(function() {
      emptyBlockingElements();
      fixtureLoader.destroy();
    });

    it('should inert new siblings', function(done) {
      document.$blockingElements.push(container);
      var input = document.createElement('input');
      container.parentNode.appendChild(input);
      // Wait for mutation observer to see the change.
      setTimeout(function() {
        assert.isTrue(input.inert, 'inerted');
        done();
      });
    });

    it('should inert new parent siblings', function(done) {
      document.$blockingElements.push(container);
      var input = document.createElement('input');
      document.body.appendChild(input);
      // Wait for mutation observer to see the change.
      setTimeout(function() {
        assert.isTrue(input.inert, 'inerted');
        document.body.removeChild(input);
        done();
      });
    });

    it('should restore inertness of removed siblings', function(done) {
      document.$blockingElements.push(container.children[0]);
      var child1 = container.children[1];
      assert.isTrue(child1.inert, 'inerted');
      container.removeChild(child1);
      // Wait for mutation observer to see the change.
      setTimeout(function() {
        assert.isFalse(child1.inert, 'inert restored');
        done();
      });
    });

    it('should remove top if it was removed', function(done) {
      document.$blockingElements.push(container);
      container.parentNode.removeChild(container);
      // Wait for mutation observer to see the change.
      setTimeout(function() {
        assert.equal(document.$blockingElements.top, null);
        done();
      });
    });
  });
})();

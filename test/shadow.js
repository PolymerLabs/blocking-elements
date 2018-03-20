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

  describe('ShadowDom v0', function() {
    if (!Element.prototype.createShadowRoot) {
      console.log('ShadowDOM v0 is not supported by the browser.');
      return;
    }

    var container;

    beforeEach(function() {
      container = fixtureLoader.load(`
        <div>
          <button>button</button>
          <button>button</button>
          <button>button</button>
        </div>`);
      var template = document.createElement('template');
      template.innerHTML = `<button>inner button</button><content></content>`;
      container.createShadowRoot().appendChild(template.content);
    });

    afterEach(function() {
      emptyBlockingElements();
      fixtureLoader.destroy();
    });

    it('update elements in shadow dom', function() {
      var shadowBtn = container.shadowRoot.querySelector('button');

      // Distributed element as a blocking element.
      document.$blockingElements.push(container.children[0]);
      assert.equal(document.$blockingElements.top, container.children[0]);
      assert.isTrue(shadowBtn.inert, 'button in shadow dom inert');
      assert.isNotOk(container.children[0].inert, '1st child active');
      assert.isTrue(container.children[1].inert, '2nd child inert');
      assert.isTrue(container.children[2].inert, '3rd child inert');

      // Button in shadow dom as a blocking element, its siblings should be inert
      document.$blockingElements.push(shadowBtn);
      assert.isTrue(document.$blockingElements.has(container.children[0]),
        '1st child is a blocking element');
      assert.equal(document.$blockingElements.top, shadowBtn);
      assert.isNotOk(shadowBtn.inert, 'button in shadow dom active');
      assert.isTrue(shadowBtn.nextElementSibling.inert, 'button sibling (slot) inert');
      assert.isNotOk(container.children[0].inert, '1st child inert restored');
      assert.isNotOk(container.children[1].inert, '2nd child inert restored');
      assert.isNotOk(container.children[2].inert, '3rd child inert restored');
    });

    it('push() adds only elements contained in document', function() {
      assert.equal(document.$blockingElements.top, null);
      // We remove the container, then we try to add one of its shadowRoot children.
      container.parentNode.removeChild(container);
      assert.throws(function() {
        document.$blockingElements.push(container.shadowRoot.firstElementChild);
      }, 'Non-connected element cannot be a blocking element');
      assert.equal(document.$blockingElements.top, null, 'element is not a blocking element');
    });
  });

  describe('ShadowDom v1', function() {
    if (!Element.prototype.attachShadow) {
      console.log('ShadowDOM v1 is not supported by the browser.');
      return;
    }

    var container;

    beforeEach(function(done) {
      container = fixtureLoader.load(`
        <div>
          <button>button</button>
          <button>button</button>
          <button>button</button>
        </div>`);
      var template = document.createElement('template');
      template.innerHTML = `<button>inner button</button><slot></slot>`;
      container.attachShadow({
        mode: 'open',
      }).appendChild(template.content);
      // Needed by ShadowDOM polyfill.
      setTimeout(function() {
        done();
      });
    });

    afterEach(function() {
      emptyBlockingElements();
      fixtureLoader.destroy();
    });

    it('update elements in shadow dom', function() {
      var shadowBtn = container.shadowRoot.querySelector('button');

      // Distributed element as a blocking element.
      document.$blockingElements.push(container.children[0]);
      assert.equal(document.$blockingElements.top, container.children[0]);
      assert.isTrue(shadowBtn.inert, 'button in shadow dom inert');
      assert.isNotOk(container.children[0].inert, '1st child active');
      assert.isTrue(container.children[1].inert, '2nd child inert');
      assert.isTrue(container.children[2].inert, '3rd child inert');

      // Button in shadow dom as a blocking element, its siblings should be inert
      document.$blockingElements.push(shadowBtn);
      assert.isTrue(document.$blockingElements.has(container.children[0]),
        '1st child is a blocking element');
      assert.equal(document.$blockingElements.top, shadowBtn);
      assert.isNotOk(shadowBtn.inert, 'button in shadow dom active');
      assert.isTrue(shadowBtn.nextElementSibling.inert, 'button sibling (slot) inert');
      assert.isNotOk(container.children[0].inert, '1st child inert restored');
      assert.isNotOk(container.children[1].inert, '2nd child inert restored');
      assert.isNotOk(container.children[2].inert, '3rd child inert restored');
    });

    it('push() adds only elements contained in document', function() {
      assert.equal(document.$blockingElements.top, null);
      // We remove the container, then we try to add one of its shadowRoot children.
      container.parentNode.removeChild(container);
      assert.throws(function() {
        document.$blockingElements.push(container.shadowRoot.firstElementChild);
      }, 'Non-connected element cannot be a blocking element');
      assert.equal(document.$blockingElements.top, null, 'element is not a blocking element');
    });
  });
})();

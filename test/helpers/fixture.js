/**
 * @license
 * Copyright 2018 Google Inc. All rights reserved.
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

window.Fixture = function Fixture() {
  if (!(this instanceof Fixture)) {
    throw new TypeError('Cannot call a class as a function');
  }

  this._fixture = undefined;

  /**
   * Stick the html into a `<div id="fixture">`.
   * @param {!string} html
   * @return {Element|NodeList<Element>|null}
   */
  this.load = function(html) {
    this._fixture = document.createElement('div');
    this._fixture.id = 'fixture';
    document.body.appendChild(this._fixture);
    this._fixture.innerHTML = html;
    var children = this._fixture.children;
    return children.length === 1 ? children[0] : children;
  };

  /**
   * Remove the current fixture and delete it.
   */
  this.destroy = function() {
    document.body.removeChild(this._fixture);
    this._fixture = undefined;
  };
  return this;
};

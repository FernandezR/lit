/**
 * @license
 * Copyright 2020 Google LLC
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

/**
 * Client-side (UI) code for the LIT tool.
 */

import '../modules/app_statusbar';
import '../modules/app_toolbar';
import '../core/modules';

import {MobxLitElement} from '@adobe/lit-mobx';
import {customElement, html, property} from 'lit-element';

import {app} from '../core/lit_app';
import {AppState} from '../services/services';

import {styles} from './app_styles.css';

/**
 * The main LIT app. Contains app-level infrastructure (such as the header,
 * footer, drawers), and renders LIT modules via the `main-page` component.
 */
@customElement('lit-app')
export class AppComponent extends MobxLitElement {
  static get styles() {
    return [styles];
  }

  private readonly appState = app.getService(AppState);

  render() {
    return html`
      <lit-app-toolbar></lit-app-toolbar>
      <!-- Main content -->
      ${this.appState.initialized ? html`<lit-modules></lit-modules>` : null}
      <lit-app-statusbar></lit-app-statusbar>
    `;
  }
}

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

// tslint:disable:no-new-decorators
import {property} from 'lit-element';
import {computed} from 'mobx';
import { observable } from 'mobx';

import {ReactiveElement} from '../lib/elements';
import {LitStaticProperties} from '../lib/types';
import {ApiService, AppState, SelectionService} from '../services/services';

import {app} from './lit_app';

/**
 * An interface describing the LitWidget element that contains the LitModule.
 */
export interface ParentWidgetElement {
  isLoading: boolean;
}

type IsLoadingFn = (isLoading: boolean) => void;

/**
 * The base class from which all Lit Module classes extends, in order to have
 * type safety for dynamically creating modules. Derives from MobxLitElement for
 * automatic reactive rendering. Provides a few helper methods for setting up
 * explicit mobx reactions with automatic disposal upon component disconnect.
 */
export abstract class LitModule extends ReactiveElement {
  /**
   * A callback used to set the loading status of the parent widget component.
   */
  @property({type: Object}) setIsLoading: IsLoadingFn = (status: boolean) => {};

  // Number of columns of the 12 column horizontal layout.
  static numCols: number = 4;

  // If true, duplicate this module in example comparison mode.
  static duplicateForExampleComparison: boolean = false;

  // If true, duplicate this module when running with more than one model.
  static duplicateForModelComparison: boolean = true;

  // If true, duplicate this module as rows, instead of columns.
  static duplicateAsRow: boolean = false;


  @property({type: String}) model = '';
  @observable @property({type: Number}) selectionServiceIndex = 0;

  // tslint:disable-next-line:no-any
  private readonly latestLoadPromises = new Map<string, Promise<any>>();

  protected readonly apiService = app.getService(ApiService);
  protected readonly appState = app.getService(AppState);

  @computed
  protected get selectionService() {
    return app.getServiceArray(SelectionService)[this.selectionServiceIndex];
  }

  /**
   * A helper method for wrapping async API calls in machinery that a)
   * automatically sets the loading state of the parent widget container and
   * b) ensures that the function only returns the value for the latest async
   * call, and null otherwise;
   */
  async loadLatest<T>(key: string, promise: Promise<T>): Promise<T|null> {
    this.latestLoadPromises.set(key, promise);
    this.setIsLoading(true);

    const result = await promise;

    if (this.latestLoadPromises.get(key) === promise) {
      this.setIsLoading(false);
      this.latestLoadPromises.delete(key);
      return result;
    }

    return null;
  }
}

/**
 * A type representing the constructor / class of a LitModule, extended with the
 * static properties that need to be defined on a LitModule.
 */
export type LitModuleType = typeof LitModule&LitStaticProperties;

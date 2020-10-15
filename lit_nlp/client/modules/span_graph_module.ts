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
 * Module within LIT for showing sequence and span tagging
 * results.
 */

// tslint:disable:no-new-decorators
import '../elements/span_graph_vis';
import '../elements/span_graph_vis_vertical';

import * as d3 from 'd3';
import {css, customElement, html, property} from 'lit-element';
import {computed, observable} from 'mobx';

import {app} from '../core/lit_app';
import {LitModule} from '../core/lit_module';
import {AnnotationLayer, EdgeLabel, SpanGraph} from '../elements/span_graph_vis';
import {IndexedInput, Input, LitName, ModelsMap, Preds, SpanLabel, Spec} from '../lib/types';
import {findSpecKeys, isLitSubtype} from '../lib/utils';

import {styles as sharedStyles} from './shared_styles.css';

interface FieldNameMultimap {
  [fieldName: string]: string[];
}

interface Annotations {
  [tokenKey: string]: SpanGraph;
}

// Shared by gold and preds modules.
const moduleStyles = css`
  .outer-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .token-group {
    padding-left: 5px;
    padding-top: 30pt;
  }

  #pred-group {
    outline: 1px dashed gray;
  }

  #gold-group{
    margin-top: 17pt;
  }
`;

const supportedPredTypes: LitName[] =
    ['SequenceTags', 'SpanLabels', 'EdgeLabels'];

/**
 * Convert sequence tags to a list of length-1 span labels.
 */
function tagsToEdges(tags: string[]): EdgeLabel[] {
  return tags.map((label: string, i: number) => {
    return {span1: [i, i + 1], label};
  });
}

/**
 * Convert span labels to single-sided edge labels.
 */
function spansToEdges(spans: SpanLabel[]): EdgeLabel[] {
  return spans.map(d => ({span1: [d.start, d.end], label: d.label}));
}

function mapTokenToTags(spec: Spec): FieldNameMultimap {
  const tagKeys = findSpecKeys(spec, supportedPredTypes);

  const tokenKeys = findSpecKeys(spec, 'Tokens');
  // Make a mapping of token keys to one or more tag sets
  const tokenToTags = {} as FieldNameMultimap;
  for (const tokenKey of tokenKeys) {
    tokenToTags[tokenKey] = [];
  }
  for (const tagKey of tagKeys) {
    const tokenKey = spec[tagKey].align as string;
    tokenToTags[tokenKey].push(tagKey);
  }
  return tokenToTags;
}

function parseInput(data: Input|Preds, spec: Spec): Annotations {
  const tokenToTags = mapTokenToTags(spec);

  // Render a row for each set of tokens
  const ret: Annotations = {};
  for (const tokenKey of Object.keys(tokenToTags)) {
    const annotationLayers: AnnotationLayer[] = [];
    for (const tagKey of tokenToTags[tokenKey]) {
      let edges = data[tagKey];
      // Temporary workaround: if we manually create a new datapoint, the span
      // or tag field may be "" rather than [].
      // TODO(lit-team): remove this once the datapoint editor is type-safe
      // for structured fields.
      if (edges.length === 0) {
        edges = [];
      }
      if (isLitSubtype(spec[tagKey], 'SequenceTags')) {
        edges = tagsToEdges(edges);
      } else if (isLitSubtype(spec[tagKey], 'SpanLabels')) {
        edges = spansToEdges(edges);
      }
      annotationLayers.push({name: tagKey, edges});
    }
    // Try to infer tokens from text, if that field is empty.
    let tokens = data[tokenKey];
    if (tokens.length === 0) {
      const textKey = findSpecKeys(spec, 'TextSegment')[0];
      tokens = data[textKey].split();
    }
    ret[tokenKey] = {tokens, layers: annotationLayers};
  }
  return ret;
}

function renderTokenGroups(data: Annotations, spec: Spec) {
  const tokenToTags = mapTokenToTags(spec);
  return html`${Object.keys(tokenToTags).map(tokenKey => {
    const labelHere = data[tokenKey]?.layers?.length === 1;
    return html`
      <div id=${tokenKey} class="token-group">
        ${labelHere ? html`<div>${data[tokenKey].layers[0].name}</div>` : null}
        <span-graph-vis-vertical .data=${data[tokenKey]} .showLayerLabel=${!labelHere}>
        </span-graph-vis-vertical>
      </div>
    `;
  })}`;
}

/** Gold predictions module class. */
@customElement('span-graph-gold-module')
export class SpanGraphGoldModule extends LitModule {
  static title = 'Structured Prediction (gold)';
  static duplicateForExampleComparison = true;
  static duplicateForModelComparison = false;
  static duplicateAsRow = true;
  static numCols = 4;
  static template = (model = '', selectionServiceIndex = 0) => {
    return html`<span-graph-gold-module selectionServiceIndex=${
        selectionServiceIndex}></span-graph-gold-module>`;
  };

  @computed
  get dataSpec() {
    return this.appState.currentDatasetSpec;
  }

  @computed
  get goldDisplayData(): Annotations {
    const input = this.selectionService.primarySelectedInputData;
    if (input === null) {
      return {};
    } else {
      return parseInput(input.data, this.dataSpec);
    }
  }

  static get styles() {
    return [sharedStyles, moduleStyles];
  }

  render() {
    return html`
      <div id="gold-group" class='outer-container'>
        ${renderTokenGroups(this.goldDisplayData, this.dataSpec)}
      </div>
    `;
  }

  static shouldDisplayModule(modelSpecs: ModelsMap, datasetSpec: Spec) {
    const hasTokens = findSpecKeys(datasetSpec, 'Tokens').length > 0;
    const hasSupportedPreds =
        findSpecKeys(datasetSpec, supportedPredTypes).length > 0;
    return (hasTokens && hasSupportedPreds);
  }
}

/** Model output module class. */
@customElement('span-graph-module')
export class SpanGraphModule extends LitModule {
  static title = 'Structured Prediction (model preds)';
  static duplicateForExampleComparison = true;
  static duplicateAsRow = true;
  static numCols = 4;
  static template = (model = '', selectionServiceIndex = 0) => {
    return html`<span-graph-module model=${model} selectionServiceIndex=${
        selectionServiceIndex}></span-graph-module>`;
  };

  @computed
  get predSpec() {
    return this.appState.getModelSpec(this.model).output;
  }

  // This is updated with an API call, via a reaction.
  @observable predDisplayData: Annotations = {};

  private async updatePredDisplayData(input: IndexedInput|null) {
    if (input === null) {
      this.predDisplayData = {};
    } else {
      const promise = this.apiService.getPreds(
          [input], this.model, this.appState.currentDataset,
          ['Tokens'].concat(supportedPredTypes));

      const results = await this.loadLatest('getPreds', promise);
      if (!results) return;

      this.predDisplayData = parseInput(results[0], this.predSpec);
    }
  }

  static get styles() {
    return [sharedStyles, moduleStyles];
  }

  firstUpdated() {
    this.reactImmediately(
        () => this.selectionService.primarySelectedInputData, input => {
          this.updatePredDisplayData(input);
        });
  }

  render() {
    return html`
      <div id="pred-group" class='outer-container'>
        ${renderTokenGroups(this.predDisplayData, this.predSpec)}
      </div>
    `;
  }

  static shouldDisplayModule(modelSpecs: ModelsMap, datasetSpec: Spec) {
    const models = Object.keys(modelSpecs);
    for (let modelNum = 0; modelNum < models.length; modelNum++) {
      const spec = modelSpecs[models[modelNum]].spec;
      const hasTokens = findSpecKeys(spec.output, 'Tokens').length > 0;
      const hasSupportedPreds =
          findSpecKeys(spec.output, supportedPredTypes).length > 0;
      if (hasTokens && hasSupportedPreds) {
        return true;
      }
    }
    return false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'span-graph-gold-module': SpanGraphGoldModule;
    'span-graph-module': SpanGraphModule;
  }
}

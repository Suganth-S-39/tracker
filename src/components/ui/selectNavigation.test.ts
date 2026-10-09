import { describe, expect, it } from 'vitest';
import { edgeIndex, findTypeahead, moveIndex } from './selectNavigation';

const none = [false, false, false, false];

describe('moveIndex', () => {
  it('moves by one and stops at the ends', () => {
    expect(moveIndex(0, 1, none)).toBe(1);
    expect(moveIndex(3, 1, none)).toBe(3);
    expect(moveIndex(0, -1, none)).toBe(0);
  });

  it('starts from the first or last option when nothing is active', () => {
    expect(moveIndex(-1, 1, none)).toBe(0);
    expect(moveIndex(-1, -1, none)).toBe(3);
  });

  it('skips disabled options', () => {
    const disabled = [false, true, true, false];
    expect(moveIndex(0, 1, disabled)).toBe(3);
    expect(moveIndex(3, -1, disabled)).toBe(0);
  });

  it('moves several options for page keys, clamped', () => {
    expect(moveIndex(0, 10, none)).toBe(3);
    expect(moveIndex(3, -10, none)).toBe(0);
  });

  it('stays put when every option is disabled', () => {
    expect(moveIndex(-1, 1, [true, true])).toBe(-1);
  });
});

describe('edgeIndex', () => {
  it('finds the first and last enabled options', () => {
    expect(edgeIndex('first', [true, false, false, true])).toBe(1);
    expect(edgeIndex('last', [true, false, false, true])).toBe(2);
    expect(edgeIndex('first', [true, true])).toBe(-1);
  });
});

describe('findTypeahead', () => {
  const labels = ['Food', 'Transport', 'Travel', 'Rent', 'Taxes'];
  const enabled = labels.map(() => false);

  it('jumps to the first match after the current option, case-insensitively', () => {
    expect(findTypeahead(labels, enabled, 't', 0)).toBe(1);
    expect(findTypeahead(labels, enabled, 'R', 0)).toBe(3);
  });

  it('cycles through options starting with a repeated letter', () => {
    expect(findTypeahead(labels, enabled, 't', 1)).toBe(2);
    expect(findTypeahead(labels, enabled, 'tt', 2)).toBe(4);
    expect(findTypeahead(labels, enabled, 'ttt', 4)).toBe(1);
  });

  it('matches longer queries, including the current option', () => {
    expect(findTypeahead(labels, enabled, 'tra', 1)).toBe(1);
    expect(findTypeahead(labels, enabled, 'trav', 1)).toBe(2);
  });

  it('skips disabled options and reports no match', () => {
    expect(findTypeahead(labels, [false, true, false, false, false], 'tr', 0)).toBe(2);
    expect(findTypeahead(labels, enabled, 'x', 0)).toBe(-1);
  });
});

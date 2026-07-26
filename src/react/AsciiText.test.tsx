// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { AsciiText } from './AsciiText.js';
import type { Source } from '../grid.js';

/** 2x1 source: one black pixel then one white pixel. */
const blackThenWhite: Source = {
  width: 2, height: 1,
  data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
};

describe('AsciiText', () => {
  test('renders the grid as text', () => {
    const { container } = render(
      <AsciiText source={blackThenWhite} mode="characters"
        cellWidth={1} cellHeight={1} ramp=" @" />);
    expect(container.querySelector('pre')?.textContent).toBe(' @');
  });

  test('renders inside a pre so columns stay aligned', () => {
    const { container } = render(
      <AsciiText source={blackThenWhite} mode="characters" cellWidth={1} cellHeight={1} />);
    expect(container.querySelector('pre')).not.toBeNull();
  });

  test('passes a class name through', () => {
    const { container } = render(
      <AsciiText source={blackThenWhite} mode="characters"
        cellWidth={1} cellHeight={1} className="art" />);
    expect(container.querySelector('pre')?.className).toContain('art');
  });

  test('splits rows onto separate lines', () => {
    const twoRows: Source = {
      width: 1, height: 2,
      data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    };
    const { container } = render(
      <AsciiText source={twoRows} mode="characters"
        cellWidth={1} cellHeight={1} ramp=" @" />);
    expect(container.querySelector('pre')?.textContent).toBe(' \n@');
  });
});

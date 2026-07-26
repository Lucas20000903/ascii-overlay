// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { AsciiSvg } from './AsciiSvg.js';
import type { Source } from '../grid.js';

/** 8x1 source: a black half then a white half, so 4px cells give two columns. */
const blackThenWhite: Source = (() => {
  const data = new Uint8ClampedArray(8 * 4);
  for (let x = 0; x < 8; x++) {
    const v = x < 4 ? 0 : 255;
    data[x * 4] = v; data[x * 4 + 1] = v; data[x * 4 + 2] = v; data[x * 4 + 3] = 255;
  }
  return { width: 8, height: 1, data };
})();

const base = { mode: 'characters', cellWidth: 4, cellHeight: 8, ramp: ' @' } as const;

describe('AsciiSvg', () => {
  test('renders an svg sized to the grid', () => {
    const { container } = render(<AsciiSvg source={blackThenWhite} {...base} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 8 8');
  });

  test('draws one text element per run', () => {
    const { container } = render(<AsciiSvg source={blackThenWhite} {...base} />);
    const texts = container.querySelectorAll('text');
    expect(texts).toHaveLength(1);
    expect(texts[0]!.textContent).toBe('@');
  });

  test('places the run at its cell position', () => {
    const { container } = render(<AsciiSvg source={blackThenWhite} {...base} />);
    expect(container.querySelector('text')!.getAttribute('x')).toBe('4');
  });

  test('pins the run to the width of its cells', () => {
    const { container } = render(<AsciiSvg source={blackThenWhite} {...base} />);
    expect(container.querySelector('text')!.getAttribute('textLength')).toBe('4');
  });

  test('paints a background rect when asked', () => {
    const { container } = render(
      <AsciiSvg source={blackThenWhite} {...base} background="#123456" />);
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('#123456');
  });

  test('leaves the background out otherwise', () => {
    const { container } = render(<AsciiSvg source={blackThenWhite} {...base} />);
    expect(container.querySelector('rect')).toBeNull();
  });

  test('applies a flat colour override', () => {
    const { container } = render(
      <AsciiSvg source={blackThenWhite} {...base} color="#ff0000" />);
    expect(container.querySelector('text')!.getAttribute('fill')).toBe('#ff0000');
  });

  test('passes render options through to the grid', () => {
    const { container } = render(
      <AsciiSvg source={blackThenWhite} {...base} invert />);
    // inverted: the bright cell takes the blank end of the ramp, the dark one '@'
    expect(container.querySelector('text')!.getAttribute('x')).toBe('0');
  });
});

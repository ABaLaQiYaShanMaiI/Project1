import { militaryStyle } from '../app/src/data/militaryStyle';
import type { StyleInputs } from '../app/src/data/style/types';

export function build(inp: StyleInputs) {
  return militaryStyle(inp);
}

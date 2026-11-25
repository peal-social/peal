/** A picture of palette indexes, row by row; 0 is transparent. */
export interface Picture {
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly width: number;
}

// Components that set a custom property inline (`--swatch`, `--code-lines`)
// import this for its types: React's style type admits custom properties
// once it is in the program. It holds no code.
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | undefined;
  }
}

export type CustomProperty = `--${string}`;

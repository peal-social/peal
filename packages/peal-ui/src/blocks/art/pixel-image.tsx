"use client";

import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { useEffect, useRef, useState } from "react";

import { createPixelImage } from "../../lib/pixel-image";
import { pixelTones } from "../../lib/pixel-palette";
import { cn } from "../../lib/utils";

type PixelImageProps = Omit<PartProps<"div">, "children" | "className"> & {
  /** What the image shows, for screen readers; empty for decoration. */
  readonly alt: string;
  readonly className?: string | undefined;
  readonly height: number;
  /** The image's address, as the app gives it; the block never builds one. */
  readonly src: string;
  readonly width: number;
};

/**
 * An image in pixel art (DESIGN.md, Pixel art): the mark's four tones on
 * 5 px cells, Bayer-dithered by darkness, on `background`. The image itself
 * is the server's HTML and keeps its `alt`; once it has loaded, the pixels
 * draw over it. An image from another origin without CORS stays as it is.
 */
const PixelImage = ({
  alt,
  className,
  height,
  render,
  src,
  width,
  ...props
}: PixelImageProps) => {
  const image = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  // Draws once the image has loaded, and again when its address changes.
  useEffect(() => {
    const start = (picture: HTMLImageElement, target: HTMLCanvasElement) => {
      let art: ReturnType<typeof createPixelImage>;

      const draw = () => {
        art?.dispose();
        art = createPixelImage(target, picture, pixelTones(target, "page"));
        setDrawn(art !== undefined);
      };

      if (picture.complete && picture.naturalWidth > 0) {
        draw();
      } else {
        picture.addEventListener("load", draw, { once: true });
      }

      return () => {
        picture.removeEventListener("load", draw);
        art?.dispose();
        setDrawn(false);
      };
    };

    const picture = image.current;
    const target = canvas.current;

    return picture === null || target === null || src === ""
      ? undefined
      : start(picture, target);
  }, [src]);

  return renderElement(
    "div",
    {
      ...props,
      children: (
        <>
          <img
            ref={image}
            alt={alt}
            src={src}
            width={width}
            height={height}
            className={cn(
              "block h-auto w-full",
              drawn ? "opacity-0" : undefined
            )}
          />
          <canvas
            ref={canvas}
            aria-hidden="true"
            className="absolute inset-0 size-full [image-rendering:pixelated]"
          />
        </>
      ),
      className: cn("relative", className),
      "data-drawn": drawn ? "" : undefined,
      "data-slot": "pixel-image",
    },
    render
  );
};

export { PixelImage };

export type { PixelImageProps };

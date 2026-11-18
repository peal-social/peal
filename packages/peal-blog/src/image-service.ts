// Astro's sharp service, which records each image URL it builds for a page
// (./image-allow.ts), so the image endpoint serves those transforms alone.
import type { LocalImageService } from "astro";
import sharpService from "astro/assets/services/sharp";

import { handedOut } from "./image-allow.ts";

const service: LocalImageService = {
  ...sharpService,
  getURL: async (options, imageConfig, logger) => {
    const url = await sharpService.getURL(options, imageConfig, logger);

    handedOut.add(url);

    return url;
  },
};

export default service;

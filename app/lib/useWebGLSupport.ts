"use client";

import { useEffect, useState } from "react";

/**
 * Detects whether the current device can reasonably run the WebGL hero scene.
 * Returns null while detecting (avoids a flash), then true/false.
 * Used to gracefully fall back to a static/video hero on low-end or
 * unsupported devices, per performance requirements.
 */
export function useWebGLSupport(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        setSupported(false);
        return;
      }

      // Rough heuristic: very small viewport + coarse pointer + low core count
      // suggests a low-end mobile device where we should favor the lighter path.
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const lowCores =
        typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2;
      const isTinyViewport = window.innerWidth < 380;

      if (isCoarsePointer && lowCores && isTinyViewport) {
        setSupported(false);
        return;
      }

      setSupported(true);
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}

import { DracoCompression } from '@babylonjs/core';
import { isTouchDevice } from './quality';

const DECODER_DIR = '/vendor/draco';

function candidateOrigins(): string[] {
  if (typeof window === 'undefined') return [];
  const origins: string[] = [];
  try {
    const ancestors = location.ancestorOrigins;
    if (ancestors?.length) {
      for (let i = 0; i < ancestors.length; i++) origins.push(ancestors[i]);
    }
  } catch {
    /* ignore */
  }
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : '';
    if (ref) origins.push(ref);
  } catch {
    /* ignore */
  }
  origins.push(window.location.origin);
  return [...new Set(origins.filter(Boolean))];
}

async function blobUrl(url: string, mime: string) {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`draco ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

let pending: Promise<void> | null = null;

/**
 * Draco WASM must not load from cdn.babylonjs.com — that stalls the first
 * avatar (often 10s+ or forever on filtered networks). Fetch from the platform
 * origin, then wrap as blob URLs so the decoder worker is same-origin.
 */
export function ensureDracoDecoder(): Promise<void> {
  if (!pending) pending = installDracoDecoder();
  return pending;
}

async function installDracoDecoder() {
  if (typeof window === 'undefined') return;
  DracoCompression.DefaultNumWorkers = isTouchDevice() ? 0 : 1;
  let lastError: unknown;
  for (const origin of candidateOrigins()) {
    const dir = `${origin}${DECODER_DIR}`;
    try {
      const wasmUrl = await blobUrl(`${dir}/draco_wasm_wrapper_gltf.js`, 'text/javascript');
      const wasmBinaryUrl = await blobUrl(`${dir}/draco_decoder_gltf.wasm`, 'application/wasm');
      let fallbackUrl: string | undefined;
      try {
        fallbackUrl = await blobUrl(`${dir}/draco_decoder_gltf.js`, 'text/javascript');
      } catch {
        fallbackUrl = undefined;
      }
      DracoCompression.Configuration = {
        decoder: { wasmUrl, wasmBinaryUrl, fallbackUrl },
      };
      return;
    } catch (err) {
      lastError = err;
    }
  }
  // Fail closed: never fall back to the Babylon CDN (hangs the lobby).
  DracoCompression.Configuration = {
    decoder: {
      wasmUrl: '',
      wasmBinaryUrl: '',
    },
  };
  console.warn('[lobby-sdk] local Draco decoder missing; compressed GLBs will fail fast', lastError);
}

/**
 * Draco WASM must not load from cdn.babylonjs.com — that stalls the first
 * avatar (often 10s+ or forever on filtered networks). Fetch from the platform
 * origin, then wrap as blob URLs so the decoder worker is same-origin.
 */
export declare function ensureDracoDecoder(): Promise<void>;
//# sourceMappingURL=draco.d.ts.map
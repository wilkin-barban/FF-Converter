import type { FFConverterAPI } from '../preload/preload';

declare global {
  interface Window {
    ffConverter: FFConverterAPI;
  }
}

export {};

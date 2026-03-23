/**
 * Global type declarations for libraries loaded via script tags
 * This tells TypeScript about globals that exist at runtime
 */

// D3.js v3 (loaded via script tag) 
declare var d3: any; // D3 v3 has different types than modern D3

// THREE.js (imported as ES module, but some parts may be global)
declare var THREE: typeof import('three');

// Google Analytics
declare var ga: (...args: any[]) => void;

// Custom globals from the application
declare var animationScenes: any;
declare var AnimationScene: any;

// Third-party astronomy libraries
declare var $const: any;
declare var $processor: any;
declare var $moshier: any;

// Custom Date extensions (from astro.js)
interface Date {
  getJD(): number;
  getMJD(): number;
  getT(): number;
}

/**
 * Global type declarations for libraries loaded via script tags
 * This tells TypeScript about globals that exist at runtime
 */

export {};

declare global {
  // D3.js v3 (loaded via script tag)
  var d3: any;

  // THREE.js (imported as ES module, but some parts may be global)
  var THREE: typeof import("three");
  var Astronomy: any;
  type AstroTime = any;

  // Google Analytics
  var ga: (...args: any[]) => void;

  // Custom globals from the application
  var animationScenes: any;
  var AnimationScene: any;

  // Third-party astronomy libraries
  var $const: any;
  var $processor: any;
  var $moshier: any;

  interface MissionDialogApi {
    init?: (selector: string, options?: Record<string, any>) => void;
    open?: (selector: string) => void;
    close?: (selector: string) => void;
    widgetElement?: (selector: string) => HTMLElement | null;
  }

  interface Window {
    missionConfig?: Record<string, any>;
    MissionDialog?: MissionDialogApi | null;
    CY3Dialog?: MissionDialogApi | null;
    CY3_UI_FLAGS?: Record<string, any>;
    MOON_RENDER_ASSET_PATHS?: Record<string, any>;
    MOON_RENDER_ASSET_PROFILE?: string;
    __landingCatalogV2?: any;
    Astronomy?: any;
    THREE?: typeof import("three");
    animationScenes?: Record<string, any>;
    AnimationScene?: any;
  }

  interface Event {
    key?: string;
  }

  interface EventTarget {
    value?: string;
  }

  interface Element {
    checked?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    value?: string;
    href?: string;
    src?: string;
    alt?: string;
    open?: boolean;
    type?: string;
    min?: string;
    max?: string;
    step?: string;
    width?: number;
    height?: number;
    offsetWidth: number;
    style: CSSStyleDeclaration;
    dataset: DOMStringMap;
    options?: HTMLOptionsCollection;
    click?: () => void;
    onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => any) | null;
    getContext?: (
      contextId: string,
      options?: any,
    ) => CanvasRenderingContext2D | null;
  }

  interface HTMLElement {
    checked?: boolean;
    disabled?: boolean;
    value?: string;
    href?: string;
    src?: string;
    alt?: string;
    open?: boolean;
    type?: string;
    min?: string;
    max?: string;
    step?: string;
    width?: number;
    height?: number;
    options?: HTMLOptionsCollection;
    select?: () => void;
    getContext?: (
      contextId: string,
      options?: any,
    ) => CanvasRenderingContext2D | null;
  }

  interface Date {
    getJD(): number;
    getMJD(): number;
    getT(): number;
    getJD_UTC(): number;
    getJD_TDB(): number;
    getMJD_TDB(): number;
    getT_TDB(): number;
  }
}

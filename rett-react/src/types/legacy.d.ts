// Type stubs for the upstream vanilla-JS calculator that gets loaded as
// classic <script> tags into the global window namespace. We don't try to
// type the full surface area — only the few entry points we call from React.
// Anything not declared here is still callable via `(window as any).fooBar`.

export {};

declare global {
  interface Window {
    // ---- Tax engine bootstrap (js/02-tax-engine) ----
    loadTaxData: (url?: string) => Promise<unknown>;
    isTaxDataLoaded: () => boolean;
    TAX_DATA: {
      loaded: boolean;
      raw: unknown;
      federal: unknown;
      states: unknown;
      years: number[];
    };

    // ---- Inputs collector (js/04-ui/inputs-collector.js) ----
    // Reads every Section 00–05 DOM input and returns the canonical input
    // object the solver consumes. We don't model the shape here.
    collectInputs?: () => Record<string, unknown>;

    // ---- Banner (js/04-ui/banner.js) ----
    showBanner?: (msg: string, level?: 'info' | 'warn' | 'error') => void;

    // ---- Print / PDF helpers used by the Strategy Summary page ----
    html2pdf?: () => any;

    // ---- Diagnostic flag the React shell sets once the legacy engine is
    // ---- finished loading. Other modules can wait for this to be true.
    __rettEngineReady?: boolean;

    // ---- Chosen-strategy state used by the Strategy Summary renderer.
    __rettChosenStrategy?: string | null;
  }
}

import { useLegacyEngine } from './hooks/useLegacyEngine';
import EngineGate from './components/EngineGate';
import Header from './components/Header';
import NavTabs from './components/NavTabs';
import Footer from './components/Footer';

import PagePMQ from './components/pages/PagePMQ';
import PageInputs from './components/pages/PageInputs';
import PageBaseline from './components/pages/PageBaseline';
import PageStrategies from './components/pages/PageStrategies';
import PageProjection from './components/pages/PageProjection';
import PageSupplemental from './components/pages/PageSupplemental';
import PageSummary from './components/pages/PageSummary';
import PageTemp from './components/pages/PageTemp';

// React renders the same DOM scaffold the upstream `index.html` ships, then
// hands navigation control entirely to upstream's `js/04-ui/controls.js`,
// which:
//   * defines the global `showPage(id)` function,
//   * toggles `.active` + `style.display` on every `<section class="page">`,
//   * wires every nav-tab button + every page-action button (Continue,
//     Back, Reset, etc.) to the appropriate `showPage(...)` call.
// So this component just renders the static page scaffolding once and lets
// upstream own all interaction state. Same behavior as upstream — no React
// state machine fighting the upstream listeners.
export default function App() {
  const engine = useLegacyEngine();

  return (
    <>
      <a href="#page-pmq" className="skip-link">Skip to main content</a>
      <Header />
      <div id="app-banner" className="app-banner" role="alert" aria-live="assertive" hidden />
      <NavTabs />
      <main>
        <PagePMQ />
        <PageInputs />
        <PageBaseline />
        <PageStrategies />
        <PageProjection />
        <PageSupplemental />
        <PageSummary />
        <PageTemp />
      </main>
      <Footer />
      <EngineGate status={engine} />
    </>
  );
}

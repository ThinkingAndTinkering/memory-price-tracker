import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { LANES } from '../lib/laneInfo';
import Hero from './Hero';
import CompositeHistory from './CompositeHistory';
import LaneCard from './LaneCard';
import EquityLane from './EquityLane';
import RetailLane from './RetailLane';
import ContractLane from './ContractLane';
import SiaLane from './SiaLane';
import CycleMap from './CycleMap';
import BuyerPanel from './BuyerPanel';
import Glossary from './Glossary';

export default function Dashboard() {
  const overview = useApi('/api/overview');
  const composite = useApi('/api/composite', []);
  const equity = useApi('/api/equity');
  const contract = useApi('/api/contract', []);
  const sia = useApi('/api/sia', []);
  const [scraping, setScraping] = useState(false);

  const ov = overview.data || {};

  async function handleScrape() {
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json();
      if (data.success) window.location.reload();
      else alert('Scrape ran but no lane returned data (sources may be blocking this IP).');
    } catch (err) {
      alert('Scrape failed: ' + err.message);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 sticky top-0 z-10 bg-gray-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Memory Price Monitor</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              DRAM &amp; NAND across the whole cycle — equities lead, contracts anchor, retail confirms.
            </p>
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="shrink-0 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {scraping ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 py-6 space-y-6">
        <Hero composite={ov.composite} cycle={ov.cycle} buySignal={ov.buySignal} />

        <CompositeHistory series={composite.data} />

        <div className="grid lg:grid-cols-2 gap-6">
          <LaneCard lane={LANES.equity}>
            <EquityLane data={equity.data} />
          </LaneCard>
          <LaneCard lane={LANES.sia}>
            <SiaLane data={sia.data} />
          </LaneCard>
        </div>

        <LaneCard lane={LANES.contract}>
          <ContractLane events={contract.data} />
        </LaneCard>

        <LaneCard lane={LANES.retail}>
          <RetailLane />
        </LaneCard>

        <CycleMap composite={ov.composite} cycle={ov.cycle} />

        <BuyerPanel data={ov.buySignal} />

        <Glossary />
      </main>

      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-5 text-center text-gray-600 text-xs leading-relaxed">
          Memory Price Monitor · Equities (Yahoo) · Retail $/GB (Newegg / diskprices) · Contract direction (TrendForce) · Billings (SIA).
          <br />Educational tool, not investment advice. Pre-live history is estimated from dated market anchors.
        </div>
      </footer>
    </div>
  );
}

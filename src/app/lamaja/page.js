'use client';

import GrafanaEmbed from './GrafanaEmbed';
import { BarChart3, Zap, Activity, TrendingUp, Gauge } from 'lucide-react';

const LamajaPage = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Header de la página */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
          <Activity size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-primary">Planta La Maja</h1>
        </div>
      </div>

      {/* Dashboard principal de La Maja */}
      <GrafanaEmbed
        dashboardId="lamaja-overview"
        title="Dashboard Principal La Maja"
        height="600px"
        showControls={true}
        autoRefresh={true}
        refresh="30s"
        from="now-24h"
        to="now"
        hideHeader={true} 
      />
    </div>
  );
};

export default LamajaPage;
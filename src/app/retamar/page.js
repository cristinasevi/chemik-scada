'use client';

import GrafanaEmbed from './GrafanaEmbed';

const RetamarPage = () => {
  return (
    <>
      {/* Dashboard principal de Retamar */}
      <GrafanaEmbed
        dashboardId="lamaja-overview"
        title="Dashboard Principal Retamar"
        height="600px"
        showControls={true}
        autoRefresh={true}
        refresh="30s"
        from="now-24h"
        to="now"
        hideHeader={true} 
      />
    </>
  );
};

export default RetamarPage;
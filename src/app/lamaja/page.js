'use client';

import GrafanaEmbed from './GrafanaEmbed';

const LamajaPage = () => {
  return (
    <>
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
    </>
  );
};

export default LamajaPage;
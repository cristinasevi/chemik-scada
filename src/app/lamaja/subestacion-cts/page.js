import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaSubestacionCTsPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="eea8yuwood7nka"
          dashboardName="05-subestacion-y-cts"
          height="100%"
          from="now-24h"
          to="now"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
        />
      </div>
    </div>
  );
}
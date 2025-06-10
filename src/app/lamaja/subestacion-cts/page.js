import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaSubestacionCTsPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="eea8yuwood7nka"
        dashboardName="05-subestacion-y-cts"
        height="345vh"
        from="now-24h"
        to="now"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
      />
    </div>
  );
}
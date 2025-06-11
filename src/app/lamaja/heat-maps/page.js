import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaHeatMapsPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="ae9vm8ee6dpfkd"
          dashboardName="01-heat-maps"
          height="100%"
          from="now-7d"
          to="now"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
        />
      </div>
    </div>
  );
}
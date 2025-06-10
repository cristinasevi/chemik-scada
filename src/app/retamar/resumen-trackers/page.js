import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarResumenTrackersPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="aea9p3o7z3oxsb"
        dashboardName="05-resumen-trackers"
        height="1000vh"
        from="now/d"
        to="now"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
        variables={{
          'var-PVO_Id': '$__all'
        }}
      />
    </div>
  );
}
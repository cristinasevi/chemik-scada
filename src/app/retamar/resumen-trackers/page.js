import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarResumenTrackersPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="aea9p3o7z3oxsb"
          dashboardName="05-resumen-trackers"
          height="100%"
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
    </div>
  );
}
import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarDetalleTrackerPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="cea5pyyuc9t3oc"
          dashboardName="06-detalle-tracker"
          height="100%"
          from="now-24h"
          to="now"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
          variables={{
            'var-PVO_id': 'TRK01'
          }}
        />
      </div>
    </div>
  );
}
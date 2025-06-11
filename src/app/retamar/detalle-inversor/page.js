import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarDetalleInversorPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="cea5pyyuc9t6oc"
          dashboardName="04-detalle-inversor"
          height="100%"
          from="now-24h"
          to="now"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
          variables={{
            'var-Inv': 'INV01'
          }}
        />
      </div>
    </div>
  );
}
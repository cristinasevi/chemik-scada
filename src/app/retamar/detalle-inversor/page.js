import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarDetalleInversorPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="cea5pyyuc9t6oc"
        dashboardName="04-detalle-inversor"
        height="307vh"
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
  );
}
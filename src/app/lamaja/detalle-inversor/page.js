import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaDetalleInversorPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="cea2pyyuc9t6oc"
        dashboardName="04-detalle-inversor"
        height="100vh"
        from="now/d"
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
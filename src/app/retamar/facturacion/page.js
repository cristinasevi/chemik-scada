import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarFacturacionPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="deizj3rq95340c"
        dashboardName="07-facturacion"
        height="155vh"
        from="now-14d"
        to="now-1d"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
      />
    </div>
  );
}
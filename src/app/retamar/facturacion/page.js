import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarFacturacionPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="deizj3rq95340c"
          dashboardName="07-facturacion"
          height="100%"
          from="now-14d"
          to="now-1d"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
        />
      </div>
    </div>
  );
}
import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarPVResumenPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="dea2pvlv5b5dsd"
          dashboardName="02-pv-resumen"
          height="100%"
          from="now/d"
          to="now/d"
          className="w-full h-full"
          refresh="5s"
          autoRefresh={true}
        />
      </div>
    </div>
  );
}
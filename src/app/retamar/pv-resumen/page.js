import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarPVResumenPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="dea2pvlv5b5dsd"
        dashboardName="02-pv-resumen"
        height="231vh"
        from="now/d"
        to="now/d"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
      />
    </div>
  );
}
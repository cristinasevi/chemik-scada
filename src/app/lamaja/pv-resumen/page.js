import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaPVResumenPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="dea2pvlv4b5dsd"
        dashboardName="02-pv-resumen"
        height="145vh"
        from="now/d"
        to="now"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
      />
    </div>
  );
}
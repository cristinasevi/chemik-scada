import GrafanaEmbed from '../GrafanaEmbed';

export default function LamajaResumenInversoresPage() {
  return (
    <div className="w-full">
      <GrafanaEmbed 
        dashboardId="bea2pxzu5zx8gc"
        dashboardName="03-resumen-inversores"
        height="120vh"
        from="now/d"
        to="now/d"
        className="w-full h-full"
        refresh="5s"
        autoRefresh={true}
        variables={{
          'var-PVO_id': '$__all'
        }}
      />
    </div>
  );
}
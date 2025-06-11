import GrafanaEmbed from '../GrafanaEmbed';

export default function RetamarResumenInversoresPage() {
  return (
    <div className="w-full">
      <div style={{ height: 'calc(100vh - 80px)' }}>
        <GrafanaEmbed 
          dashboardId="bea1pxzu5zx8gc"
          dashboardName="03-resumen-inversores"
          height="100%"
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
    </div>
  );
}
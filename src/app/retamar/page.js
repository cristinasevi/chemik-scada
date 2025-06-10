import GrafanaEmbed from './GrafanaEmbed';
import RetamarAlarmsTable from './RetamarAlarmsTable';

export default function RetamarPage() {
  return (
    <div className="w-full">
      <div className="w-full">
        <GrafanaEmbed 
          height="140vh"
          from="now/d"
          to="now"
          className="w-full h-full"
        />
      </div>
      
      <RetamarAlarmsTable />
    </div>
  );
}
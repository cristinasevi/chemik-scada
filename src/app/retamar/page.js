import GrafanaEmbed from './GrafanaEmbed';
import RetamarAlarmsTable from './RetamarAlarmsTable';

export default function RetamarPage() {
  return (
    <div className="w-full">
      <div className="w-full">
        <GrafanaEmbed 
          height="155vh"
          from="now/d"
          to="now"
          className="w-full"
        />
      </div>
      
      <div className="w-full">
        <RetamarAlarmsTable />
      </div>
    </div>
  );
}
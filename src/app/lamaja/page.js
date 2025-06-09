import GrafanaEmbed from './GrafanaEmbed';
import LaMajaAlarmsTable from './LaMajaAlarmsTable';

export default function LamajaPage() {
  return (
    <div className="w-full">
      <div className="w-full">
        <GrafanaEmbed 
          height="132vh"
          from="now-24h"
          to="now"
          className="w-full h-full"
        />
      </div>
      
      <LaMajaAlarmsTable />
    </div>
  );
}
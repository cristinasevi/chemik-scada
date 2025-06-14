import Map from "./components/Dashboard/Map";
import PlantsTable from "./components/Dashboard/PlantsTable";
import PowerChart from './components/Dashboard/PowerChart';
import MonthlyProductionChart from './components/Dashboard/MonthlyProductionChart';
import AlarmsTable from "./components/Dashboard/AlarmsTable";

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <Map />
      <PlantsTable />
      <PowerChart height="400px" />
      <MonthlyProductionChart height="400px" />
      <AlarmsTable />
    </div>
  );
}
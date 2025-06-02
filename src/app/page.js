import Map from "./components/Dashboard/Map";
import PlantsTable from "./components/Dashboard/PlantsTable";
import PowerChart from './components/PowerChart';

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <Map />
      <PlantsTable />
      <PowerChart height="400px" />
    </div>
  );
}
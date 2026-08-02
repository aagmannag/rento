import PageHeader from "@/components/PageHeader";
import VehicleForm from "@/components/VehicleForm";

export default function NewVehiclePage() {
  return (
    <div>
      <PageHeader title="Add a vehicle" subtitle="Fill in the details below to list a new vehicle" />
      <div className="max-w-3xl">
        <VehicleForm mode="create" />
      </div>
    </div>
  );
}

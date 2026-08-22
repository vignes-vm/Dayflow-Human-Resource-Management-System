import { DataTable } from "@/components/DataTable";

export const title = "DataTable";

interface Row {
  id: string;
  name: string;
  hours: number;
}

const rows: Row[] = [
  { id: "1", name: "Meera Krishnan", hours: 172.5 },
  { id: "2", name: "Priya Rao", hours: 160 },
  { id: "3", name: "Karan Mehta", hours: 168.25 },
];

export default function DataTableDemo() {
  return (
    <div className="space-y-8">
      <DataTable
        columns={[
          { id: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
          {
            id: "hours",
            header: "Hours",
            numeric: true,
            cell: (r) => r.hours.toFixed(2),
            sortValue: (r) => r.hours,
          },
        ]}
        data={rows}
        getRowId={(r) => r.id}
      />
      <DataTable
        columns={[{ id: "name", header: "Name", cell: (r: Row) => r.name }]}
        data={[]}
        getRowId={(r: Row) => r.id}
        emptyTitle="No rows"
      />
      <DataTable
        columns={[{ id: "name", header: "Name", cell: (r: Row) => r.name }]}
        data={[]}
        getRowId={(r: Row) => r.id}
        loading
      />
    </div>
  );
}

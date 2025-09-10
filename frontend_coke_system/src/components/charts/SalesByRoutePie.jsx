import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import Empty from "../common/Empty";
import { peso, COLORS } from "../../utils/formatters";

export default function SalesByRoutePie({ data = [] }) {
  return (
    <div className="h-56">
      {data.length === 0 ? (
        <Empty />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(v) => peso(v)} />
            <Legend />
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BiasChartProps {
  selectionRates: Record<string, number>;
}

const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6"];

export default function BiasChart({ selectionRates }: BiasChartProps) {
  const data = Object.entries(selectionRates).map(([group, rate]) => ({
    group: group.charAt(0).toUpperCase() + group.slice(1),
    rate: +(rate * 100).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
        <XAxis
          dataKey="group"
          tick={{ fill: "var(--muted)", fontSize: 13 }}
          axisLine={{ stroke: "var(--card-border)" }}
        />
        <YAxis
          tick={{ fill: "var(--muted)", fontSize: 13 }}
          axisLine={{ stroke: "var(--card-border)" }}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--card-border)",
            borderRadius: "8px",
            fontSize: "13px",
          }}
          formatter={(value) => [`${value}%`, "Selection Rate"]}
        />
        <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={80}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

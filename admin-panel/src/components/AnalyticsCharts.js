import React from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

const chartOptions = {
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#888" } },
    y: { grid: { color: "#f0f2f5" }, ticks: { stepSize: 1, color: "#888" } },
  },
};

export function BookingBarChart({ data }) {
  const bookingsPerDate = {};
  data.forEach((b) => {
    bookingsPerDate[b.date] = (bookingsPerDate[b.date] || 0) + 1;
  });

  const barData = {
    labels: Object.keys(bookingsPerDate),
    datasets: [
      {
        label: "Bookings",
        data: Object.values(bookingsPerDate),
        backgroundColor: "#003580",
        borderRadius: 6,
      },
    ],
  };

  return <Bar data={barData} options={chartOptions} />;
}

export function VisitorPieChart({ data }) {
  const totalAdults = data.reduce((sum, b) => sum + b.adults, 0);
  const totalChildren = data.reduce((sum, b) => sum + b.children, 0);

  const pieData = {
    labels: ["Adults", "Children"],
    datasets: [
      {
        data: [totalAdults, totalChildren],
        backgroundColor: ["#003580", "#febb02"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <Pie
      data={pieData}
      options={{ plugins: { legend: { position: "bottom" } } }}
    />
  );
}

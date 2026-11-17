"use client";

import { memo, useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { SalesDay } from "@dc/contracts";
import { money } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart";

const config = {
  net: { label: "Penjualan neto", color: "var(--red)" },
} satisfies ChartConfig;
const shortMoney = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});
function dateLabel(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export const SalesTrend = memo(function SalesTrend({
  data,
  from,
  to,
  pending = false,
  unavailable = false,
}: {
  data: SalesDay[];
  from: string;
  to: string;
  pending?: boolean;
  unavailable?: boolean;
}) {
  const gradientId = `sales-fill-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const values = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) =>
      new Date(new Date(`${to}T12:00:00Z`).getTime() - (6 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
    ).filter((date) => date >= from && date <= to);
    return dates.map(
      (date) =>
        data.find((day) => day.date === date) || {
          date,
          gross: 0,
          refunds: 0,
          net: 0,
        },
    );
  }, [data, from, to]);
  const min = Math.min(0, ...values.map((day) => day.net));
  const max = Math.max(0, ...values.map((day) => day.net));
  const empty = values.every((day) => day.gross === 0 && day.refunds === 0);
  if (unavailable)
    return (
      <p className="sales-trend" role="note">
        Grafik belum tersedia karena laporan gagal dimuat.
      </p>
    );
  return (
    <div className="sales-trend" aria-busy={pending}>
      <p className="sales-trend-readout" role="status">
        {pending
          ? "Memuat tren penjualan…"
          : empty
            ? "Belum ada penjualan atau refund pada hari yang ditampilkan."
            : "Sentuh titik atau gunakan tombol panah pada chart untuk melihat rincian harian."}
      </p>
      <ChartContainer
        config={config}
        className="sales-trend-container h-[280px] min-h-[280px] w-full aspect-auto"
      >
        <AreaChart
          accessibilityLayer
          aria-label="Tren penjualan neto harian"
          data={values}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-net)"
                stopOpacity={0.24}
              />
              <stop
                offset="100%"
                stopColor="var(--color-net)"
                stopOpacity={0.025}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={dateLabel}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            minTickGap={12}
            height={38}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            tickFormatter={(value) => shortMoney.format(value)}
            domain={min === max ? [0, 10000] : [min, max]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={62}
          />
          <ReferenceLine
            y={0}
            stroke="var(--text-muted)"
            strokeDasharray="4 4"
          />
          <ChartTooltip
            cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(label) => dateLabel(String(label))}
                formatter={(_value, _name, item) => {
                  const day = item.payload as SalesDay;
                  return (
                    <div className="sales-trend-tooltip-values">
                      <span>
                        Penjualan neto<strong>{money(day.net)}</strong>
                      </span>
                      <span>
                        Penjualan bruto<strong>{money(day.gross)}</strong>
                      </span>
                      <span>
                        Refund<strong>{money(day.refunds)}</strong>
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Area
            dataKey="net"
            name="Penjualan neto"
            type="monotone"
            baseValue={0}
            stroke="var(--color-net)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{
              r: 3,
              fill: "var(--color-net)",
              stroke: "var(--background)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 5, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
      <details className="sales-trend-data">
        <summary>Lihat data harian</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Rincian penjualan dan refund harian
            </caption>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Bruto</th>
                <th>Refund</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              {values.map((day) => (
                <tr key={day.date}>
                  <td>{dateLabel(day.date)}</td>
                  <td>{money(day.gross)}</td>
                  <td>{money(day.refunds)}</td>
                  <td>{money(day.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
});

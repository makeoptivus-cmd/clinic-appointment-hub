import { useMemo, useState } from "react";
import { endOfMonth, endOfWeek, format, isWithinInterval, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { Download, FileText, Database, TrendingUp } from "lucide-react";
import AppMenuBar from "@/components/AppMenuBar";
import { useAppointments } from "@/hooks/useAppointments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database as DB } from "@/integrations/supabase/types";

type Appointment = DB["public"]["Tables"]["appointments"]["Row"];
type ReportRange = "daily" | "weekly" | "monthly";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const toCsv = (rows: Appointment[]) => {
  const headers = [
    "Date",
    "Time",
    "Name",
    "Mobile",
    "Status",
    "Problem",
    "Amount",
    "WhatsApp Delivery",
    "Updated At",
  ];
  const lines = rows.map((row) =>
    [
      row.preferred_date,
      row.preferred_time ?? "",
      row.full_name,
      row.mobile_number,
      row.status,
      row.problem ?? "",
      String(row.amount ?? 0),
      row.whatsapp_delivery_status ?? "pending",
      row.updated_at,
    ]
      .map((cell) => `"${String(cell).replaceAll(`"`, `""`)}`)
      .join(",")
  );
  return [headers.join(","), ...lines].join("\n");
};

const downloadCsv = (filename: string, rows: Appointment[]) => {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const printPdf = (title: string, rows: Appointment[], revenue: number) => {
  const htmlRows = rows
    .map(
      (row) => `
      <tr>
        <td>${row.preferred_date}</td>
        <td>${row.preferred_time ?? "-"}</td>
        <td>${row.full_name}</td>
        <td>${row.mobile_number}</td>
        <td>${row.status}</td>
        <td>${row.problem ?? "-"}</td>
        <td>${row.amount ?? 0}</td>
      </tr>`
    )
    .join("");

  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { margin-bottom: 4px; }
          p { margin-top: 0; color: #555; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Revenue: ${currency.format(revenue)}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Name</th><th>Mobile</th><th>Status</th><th>Problem</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const Reports = () => {
  const { appointments, loading } = useAppointments();
  const [range, setRange] = useState<ReportRange>("daily");
  const [anchorDate, setAnchorDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { filtered, dailyCount, weeklyCount, pendingCount, revenue } = useMemo(() => {
    const anchor = parseISO(anchorDate);
    const dailyStart = anchor;
    const dailyEnd = anchor;
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);

    const inRange = (dateStr: string) => {
      const d = parseISO(dateStr);
      if (range === "daily") return isWithinInterval(d, { start: dailyStart, end: dailyEnd });
      if (range === "weekly") return isWithinInterval(d, { start: weekStart, end: weekEnd });
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    };

    const filteredRows = appointments.filter((a) => inRange(a.preferred_date));
    const daily = appointments.filter((a) => a.preferred_date === format(anchor, "yyyy-MM-dd")).length;
    const weekly = appointments.filter((a) =>
      isWithinInterval(parseISO(a.preferred_date), { start: weekStart, end: weekEnd })
    ).length;
    const pending = filteredRows.filter((a) => ["New", "Confirmed"].includes(a.status)).length;
    const revenueSum = filteredRows
      .filter((a) => !["Cancelled", "No Show"].includes(a.status))
      .reduce((sum, a) => sum + Number(a.amount ?? 0), 0);

    return {
      filtered: filteredRows,
      dailyCount: daily,
      weeklyCount: weekly,
      pendingCount: pending,
      revenue: revenueSum,
    };
  }, [appointments, range, anchorDate]);

  return (
    <div className="min-h-screen bg-background">
      <AppMenuBar />
      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Daily, weekly, pending, revenue insights with export and backup options.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Range</Label>
              <Select value={range} onValueChange={(value) => setRange(value as ReportRange)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anchor Date</Label>
              <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:items-end justify-end">
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => downloadCsv(`reports-${range}-${anchorDate}.csv`, filtered)}
                disabled={loading}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                className="w-full md:w-auto"
                onClick={() => printPdf(`Clinic Report (${range}) - ${anchorDate}`, filtered, revenue)}
                disabled={loading}
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Daily Appointments</CardDescription>
              <CardTitle>{dailyCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Weekly Appointments</CardDescription>
              <CardTitle>{weeklyCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending ({range})</CardDescription>
              <CardTitle>{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Revenue ({range})</CardDescription>
              <CardTitle className="inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {currency.format(revenue)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Report Records</CardTitle>
            <CardDescription>{filtered.length} appointments in selected range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Problem</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">{a.preferred_date}</td>
                      <td className="p-2">{a.preferred_time || "-"}</td>
                      <td className="p-2">{a.full_name}</td>
                      <td className="p-2">{a.mobile_number}</td>
                      <td className="p-2">{a.status}</td>
                      <td className="p-2">{a.problem || "-"}</td>
                      <td className="p-2">{currency.format(Number(a.amount ?? 0))}</td>
                      <td className="p-2 capitalize">{a.whatsapp_delivery_status || "pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup Strategy
            </CardTitle>
            <CardDescription>
              Recommended backup approach for clinic data safety.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Daily automated Supabase backup (database-level snapshot).</li>
              <li>Weekly CSV export stored in cloud drive.</li>
              <li>Monthly PDF summary archive for compliance review.</li>
              <li>Quarterly restore drill on staging to verify backup health.</li>
            </ol>
            <div className="pt-1">
              <Button
                variant="outline"
                onClick={() => downloadCsv(`appointments-backup-${format(new Date(), "yyyy-MM-dd")}.csv`, appointments)}
                disabled={loading}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Full Backup CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;

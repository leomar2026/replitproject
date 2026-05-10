import { useState } from "react";
import { useListAttendance, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function Attendance() {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [status, setStatus] = useState<string>("all");

  const { data: records, isLoading } = useListAttendance({
    date: date || undefined,
    status: status !== "all" ? status : undefined,
    employeeId: search || undefined
  });

  const handleExport = () => {
    const url = new URL("/api/reports/export", window.location.origin);
    url.searchParams.set("format", "csv");
    if (date) url.searchParams.set("from", date);
    if (date) url.searchParams.set("to", date);
    
    // Check if token exists to attach
    const token = localStorage.getItem("attendance_token");
    
    // Since we need auth, creating a direct link might fail if the server expects bearer header.
    // Instead we can fetch and download.
    fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-report-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Records</h1>
          <p className="text-muted-foreground mt-1">View and export daily attendance data.</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="shrink-0">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by Employee ID..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  type="date"
                  className="pl-9 w-[160px]"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Loading records...
                    </TableCell>
                  </TableRow>
                ) : records?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No records found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  records?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">{record.employeeId}</TableCell>
                      <TableCell className="font-medium">{record.employeeName}</TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>{record.timeIn ? format(new Date(record.timeIn), "hh:mm a") : "--"}</TableCell>
                      <TableCell>{record.timeOut ? format(new Date(record.timeOut), "hh:mm a") : "--"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.locationAddress || ""}>
                        {record.locationAddress || "--"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            record.status === "present" ? "default" : 
                            record.status === "late" ? "secondary" : 
                            "destructive"
                          }
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
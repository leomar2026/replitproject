import { useGetEmployee, useListEmployeeHistory } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { User, Phone, MapPin, Building, Briefcase, Hash } from "lucide-react";

export default function EmployeeDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: employee, isLoading: empLoading } = useGetEmployee(id);
  const { data: history, isLoading: histLoading } = useListEmployeeHistory(
    { employeeId: employee?.employeeId || "" },
    { query: { enabled: !!employee?.employeeId } }
  );

  if (empLoading) return <div className="animate-pulse h-96 bg-muted rounded-xl"></div>;
  if (!employee) return <div>Employee not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employee Profile</h1>
        <p className="text-muted-foreground mt-1">Details and attendance history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                <User className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold">{employee.fullName}</h2>
              <Badge variant="secondary" className="mt-2 font-mono">{employee.employeeId}</Badge>
            </div>
            
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-3 text-sm">
                <Building className="w-4 h-4 text-muted-foreground" />
                <span>{employee.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <span>{employee.position}</span>
              </div>
              {employee.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{employee.phone}</span>
                </div>
              )}
              {employee.biometricId && (
                <div className="flex items-center gap-3 text-sm">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono">{employee.biometricId}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histLoading ? (
                     <TableRow>
                     <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                       Loading history...
                     </TableCell>
                   </TableRow>
                  ) : history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No attendance history found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{record.timeIn ? format(new Date(record.timeIn), "hh:mm a") : "--"}</TableCell>
                        <TableCell>{record.timeOut ? format(new Date(record.timeOut), "hh:mm a") : "--"}</TableCell>
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
    </div>
  );
}
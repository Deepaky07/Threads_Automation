import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, RefreshCw, CheckCircle, Loader } from "lucide-react";

interface SheetData {
  connected: boolean;
  message?: string;
  headers?: string[];
  rows?: unknown[][];
  error?: string;
}

interface RowData {
  id: number;
  row_data: Record<string, string>;
  created_at: string;
}

export default function Spreadsheet() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("📊 Fetching Google Sheets data...");

      const response = await fetch("http://localhost:3000/api/google-sheets", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: SheetData = await response.json();

      console.log("✅ Response received:", result);

      if (!result) {
        throw new Error("No data received from server");
      }

      setIsConnected(result.connected || false);

      // Only process if connected and has data
      if (result.connected && result.rows && Array.isArray(result.rows)) {
        setHeaders(result.headers || []);

        const formattedData: RowData[] = result.rows.map((row, index) => {
          const row_data: Record<string, string> = {};

          if (Array.isArray(row)) {
            row.forEach((value, colIndex) => {
              const colName = result.headers?.[colIndex] || `column${colIndex + 1}`;
              row_data[colName] = String(value || "");
            });
          }

          return {
            id: index,
            row_data,
            created_at: new Date().toISOString(),
          };
        });

        setData(formattedData);
        toast.success("✅ Data loaded successfully!");
      } else if (!result.connected) {
        setData([]);
        setHeaders([]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      console.error("Detailed fetch error:", {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : "No stack",
        response: err,
      });

      setError(errorMessage);
      setData([]);
      setHeaders([]);
      toast.error(`❌ Failed to fetch data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth and fetch data
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/", { replace: true });
      } else {
        console.log("✅ User authenticated, fetching data...");
        fetchData();
      }
    }
  }, [user, authLoading, fetchData, navigate]);

  const deleteRow = (id: number) => {
    setData((prev) => prev.filter((row) => row.id !== id));
    toast.success("Row deleted");
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              📊 Google Sheets Integration
            </h1>
            <p className="text-slate-600">
              Manage your spreadsheet data here
            </p>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Status Card - Ready to Use */}
        {!isConnected ? (
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-300 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="font-semibold text-blue-900 text-lg">
                  ✅ System Ready
                </h2>
                <p className="text-sm text-blue-800 mt-1">
                  Google Sheets integration is optional. Your Threads automation is fully functional!
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  💡 To enable Google Sheets: Add GOOGLE_SHEETS_ID and GOOGLE_API_KEY to your .env file
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Error Card */}
        {error && (
          <Card className="p-6 bg-red-50 border border-red-300 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0">❌</div>
              <div>
                <h2 className="font-semibold text-red-900">Error</h2>
                <p className="text-sm text-red-800 mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Data Table - Only show if connected and has data */}
        {isConnected && data.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>📈 Sheet Data</CardTitle>
              <CardDescription>
                {data.length} rows found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.length > 0 ? (
                        headers.map((header, index) => (
                          <TableHead key={index}>{header}</TableHead>
                        ))
                      ) : (
                        <>
                          <TableHead>Column 1</TableHead>
                          <TableHead>Column 2</TableHead>
                          <TableHead>Column 3</TableHead>
                        </>
                      )}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow key={row.id}>
                        {headers.length > 0 ? (
                          headers.map((header, index) => (
                            <TableCell key={index}>
                              {row.row_data[header] || "-"}
                            </TableCell>
                          ))
                        ) : (
                          <>
                            <TableCell>{row.row_data.column1 || "-"}</TableCell>
                            <TableCell>{row.row_data.column2 || "-"}</TableCell>
                            <TableCell>{row.row_data.column3 || "-"}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <Button
                            onClick={() => deleteRow(row.id)}
                            size="sm"
                            variant="ghost"
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : isConnected ? (
          <Card className="p-12 text-center">
            <p className="text-slate-600">📭 No data available</p>
          </Card>
        ) : null}

        {/* Info Card - Always show helpful info */}
        {!isConnected && (
          <Card className="p-6 bg-slate-50 border border-slate-200">
            <CardHeader>
              <CardTitle>About This Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                ✅ <strong>Your Threads automation is fully functional!</strong> You don't need Google Sheets to use the platform.
              </p>
              <p>
                📌 Google Sheets integration is <strong>optional</strong> and can be added anytime.
              </p>
              <p>
                🚀 You can use all other features:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Like, Comment & Reply automation</li>
                <li>Notification checker</li>
                <li>Search bot</li>
                <li>Post creator</li>
              </ul>
              <p className="mt-4">
                💡 <strong>To enable Google Sheets later:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Get Google API credentials</li>
                <li>Add to .env file: GOOGLE_SHEETS_ID and GOOGLE_API_KEY</li>
                <li>Restart server</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
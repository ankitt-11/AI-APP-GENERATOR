'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appsApi, csvApi } from '@/lib/api/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Upload, CheckCircle, AlertTriangle, ArrowRight, FileSpreadsheet,
  Settings2, Loader2, PlayCircle, HelpCircle, CheckCircle2, ChevronRight, RefreshCw, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/client';

type Step = 'upload' | 'mapping' | 'results';

interface MappingItem {
  csvColumn: string;
  fieldSlug: string;
}

export default function CsvImportsPage() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<Step>('upload');

  // Step 1 States
  const [selectedAppId, setSelectedAppId] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Step 2 States
  const [importId, setImportId] = useState('');
  const [detectedColumns, setDetectedColumns] = useState<Array<{ name: string; inferredType: string }>>([]);
  const [entityFields, setEntityFields] = useState<Array<{ slug: string; name: string; type: string; required: boolean }>>([]);
  const [mappings, setMappings] = useState<MappingItem[]>([]);

  // Step 3 States
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch applications list
  const { data: appsData, isLoading: isAppsLoading } = useQuery({
    queryKey: ['apps'],
    queryFn: () => appsApi.list(1, 100),
  });

  const apps = appsData?.data ?? [];

  // Get selected app to extract its entities
  const selectedApp = apps.find((a: any) => a.id === selectedAppId);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedAppId || !selectedEntityId || !file) {
        throw new Error('Please select an application, entity and file');
      }
      return csvApi.upload(selectedAppId, selectedEntityId, file);
    },
    onSuccess: (res) => {
      setImportId(res.importId);
      setDetectedColumns(res.detectedColumns || []);
      setEntityFields(res.entityFields || []);

      // Initialize mappings with suggested mappings or defaults
      const suggested = res.suggestedMappings || [];
      const initialMappings = res.detectedColumns.map((col: any) => {
        const suggMatch = suggested.find((s: any) => s.csvColumn === col.name);
        return {
          csvColumn: col.name,
          fieldSlug: suggMatch ? suggMatch.fieldSlug : '',
        };
      });
      setMappings(initialMappings);
      setActiveStep('mapping');
      toast.success('CSV uploaded and analyzed successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to upload CSV file');
    },
  });

  // Process mutation
  const processMutation = useMutation({
    mutationFn: () => csvApi.process(selectedAppId, importId, mappings),
    onSuccess: (res) => {
      setImportResult(res.report);
      setActiveStep('results');
      toast.success('CSV Import process completed!');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to process import');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.type !== 'text/csv' && !selected.name.endsWith('.csv')) {
        toast.error('Only CSV files are allowed');
        return;
      }
      setFile(selected);
    }
  };

  const handleMappingChange = (csvColumn: string, fieldSlug: string) => {
    setMappings((prev) =>
      prev.map((item) =>
        item.csvColumn === csvColumn ? { ...item, fieldSlug } : item,
      ),
    );
  };

  const resetWizard = () => {
    setFile(null);
    setImportId('');
    setDetectedColumns([]);
    setEntityFields([]);
    setMappings([]);
    setImportResult(null);
    setActiveStep('upload');
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CSV Data Import</h1>
        <p className="text-muted-foreground mt-1">Upload records in bulk and map columns to entity schemas dynamically</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-sm">
        {[
          { key: 'upload', label: '1. Upload CSV', desc: 'Select app and upload file' },
          { key: 'mapping', label: '2. Schema Mapping', desc: 'Link CSV columns to fields' },
          { key: 'results', label: '3. Import Summary', desc: 'View import health report' },
        ].map((s, idx) => {
          const isCompleted =
            (activeStep === 'mapping' && idx === 0) ||
            (activeStep === 'results' && idx <= 1);
          const isActive = activeStep === s.key;

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-zinc-50 border border-zinc-950 scale-105 shadow-sm'
                    : isCompleted
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-semibold leading-none ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
              {idx < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block mx-2" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload Panel */}
      {activeStep === 'upload' && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Select Destination & Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="app-select">Target Application *</Label>
                {isAppsLoading ? (
                  <div className="h-10 rounded-md bg-muted/60 animate-shimmer" />
                ) : (
                  <select
                    id="app-select"
                    value={selectedAppId}
                    onChange={(e) => {
                      setSelectedAppId(e.target.value);
                      setSelectedEntityId('');
                    }}
                    className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select an application...</option>
                    {apps.map((app: any) => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-select">Target Entity *</Label>
                <select
                  id="entity-select"
                  disabled={!selectedAppId}
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Select an entity...</option>
                  {selectedApp?.entities?.map((ent: any) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drag & Drop File Upload */}
            <div className="space-y-2">
              <Label>Select CSV File *</Label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground/35 mx-auto mb-3 group-hover:scale-105 transition-transform" />
                {file ? (
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-primary">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">Drag & drop your CSV file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Files up to 10MB in size are supported</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="default"
                disabled={!selectedAppId || !selectedEntityId || !file || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
              >
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />}
                Analyze CSV Schema
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping Panel */}
      {activeStep === 'mapping' && (
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Schema & Column Alignment</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Map each header column found in CSV file to matching database fields</p>
            </div>
            <Button variant="ghost" size="xs" onClick={resetWizard} className="h-7 text-[10px]">
              Cancel & Start Over
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">CSV Column Title</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Detected Type</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Target Field (Schema)</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedColumns.map((col) => {
                    const currentMapping = mappings.find((m) => m.csvColumn === col.name);

                    return (
                      <tr key={col.name} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-6 py-4 font-mono font-medium text-foreground">
                          {col.name}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[10px] font-mono lowercase">
                            {col.inferredType}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={currentMapping?.fieldSlug || ''}
                            onChange={(e) => handleMappingChange(col.name, e.target.value)}
                            className="w-full max-w-xs h-9 px-3 border border-input rounded-md bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Do not import (Ignore)</option>
                            {entityFields.map((field) => (
                              <option key={field.slug} value={field.slug}>
                                {field.name} ({field.type}){field.required ? ' *' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-5 bg-muted/30 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Settings2 className="w-3.5 h-3.5" />
                Review that required fields (indicated by *) are aligned.
              </div>
              <Button
                variant="default"
                disabled={processMutation.isPending}
                onClick={() => processMutation.mutate()}
              >
                {processMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}
                Run Data Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results Summary */}
      {activeStep === 'results' && importResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/20 text-success">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-success">{importResult.successRows}</p>
                  <p className="text-xs text-muted-foreground">Successfully Imported</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/20 text-destructive">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-destructive">{importResult.failedRows}</p>
                  <p className="text-xs text-muted-foreground">Rows Rejected</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted text-foreground">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{importResult.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Processed Rows</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quarantine report (errors) */}
          {importResult.failedRows > 0 && importResult.failures && (
            <Card className="border-destructive/30 shadow-md">
              <CardHeader className="bg-destructive/5 border-b border-destructive/10 py-4">
                <CardTitle className="text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Import Quarantine Report
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The following rows could not be saved. They were quarantined due to schema validation failures. Other rows were saved.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 sticky top-0">
                        <th className="text-left px-6 py-3 font-semibold text-muted-foreground w-16">Row</th>
                        <th className="text-left px-6 py-3 font-semibold text-muted-foreground w-2/5">Raw CSV Content</th>
                        <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Validation Failures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.failures.map((fail: any, i: number) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/10">
                          <td className="px-6 py-4 font-mono font-bold text-muted-foreground">
                            {fail.row}
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground break-all whitespace-pre-wrap">
                            {JSON.stringify(fail.rowValues)}
                          </td>
                          <td className="px-6 py-4 space-y-1">
                            {fail.errors?.map((err: string, j: number) => (
                              <p key={j} className="text-destructive font-semibold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {err}
                              </p>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={resetWizard}>
              Import Another File
            </Button>
            <Button asChild variant="default">
              <Link href={`/apps/${selectedAppId}`}>
                Go to App Overview
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

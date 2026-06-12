'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { metadataApi, aiApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, CheckCircle2, AlertTriangle, AlertCircle, Save,
  ArrowLeft, RefreshCw, Bot, Code, HelpCircle, Undo2, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function MetadataBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const appId = params.id as string;

  const [jsonText, setJsonText] = useState('');
  const [changelog, setChangelog] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors?: any[];
    warnings?: any[];
  } | null>(null);

  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [repairedMetadata, setRepairedMetadata] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Fetch active metadata version
  const { data: activeMetadata, isLoading: isMetadataLoading } = useQuery({
    queryKey: ['active-metadata', appId],
    queryFn: () => metadataApi.getActive(appId),
    enabled: !!appId,
  });

  // Load metadata definition into textarea on success
  useEffect(() => {
    if (activeMetadata) {
      const formatted = JSON.stringify(activeMetadata, null, 2);
      setJsonText(formatted);
      setHistory([formatted]);
    }
  }, [activeMetadata]);

  // Local JSON parsing & Schema validation
  const validateJson = async (text: string) => {
    if (!text.trim()) {
      setParseError('Metadata definition cannot be empty');
      setValidationResult(null);
      return null;
    }

    try {
      const parsed = JSON.parse(text);
      setParseError(null);

      // Call API validate endpoint
      const result = await metadataApi.validate(appId, parsed);
      setValidationResult({
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
      });
      return parsed;
    } catch (e: any) {
      setParseError(e.message || 'Invalid JSON syntax');
      setValidationResult(null);
      return null;
    }
  };

  // Trigger validation as user edits
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    validateJson(val);
  };

  // Save metadata version
  const saveMutation = useMutation({
    mutationFn: (body: { definition: any; changelog: string }) =>
      metadataApi.save(appId, body.definition, body.changelog),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['apps', appId] });
      queryClient.invalidateQueries({ queryKey: ['metadata-versions', appId] });
      queryClient.invalidateQueries({ queryKey: ['active-metadata', appId] });
      toast.success(`Metadata version saved! Version: v${res.version}`);
      router.push(`/apps/${appId}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save metadata');
    },
  });

  const handleSave = async () => {
    const parsed = await validateJson(jsonText);
    if (!parsed) {
      toast.error('Cannot save. Please fix JSON syntax errors first.');
      return;
    }

    if (validationResult && !validationResult.isValid) {
      toast.error('Metadata contains validation errors. Please check issues.');
      return;
    }

    if (!changelog.trim()) {
      toast.error('Changelog description is required.');
      return;
    }

    saveMutation.mutate({
      definition: parsed,
      changelog: changelog.trim(),
    });
  };

  // Trigger AI suggestions analysis
  const runAiAnalysis = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      setIsAnalyzing(true);
      setParseError(null);

      const res = await aiApi.analyze(parsed);
      setAiSuggestions(res.suggestions || []);
      setRepairedMetadata(res.repaired || null);

      if (res.suggestions?.length > 0) {
        toast.info(`AI analysis complete: found ${res.suggestions.length} suggestions!`);
      } else {
        toast.success('AI analysis complete: metadata looks clean and optimized!');
      }
    } catch (e: any) {
      toast.error('Please fix JSON parsing errors before running AI analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Apply AI repairs (replace JSON in textarea)
  const applyRepairs = () => {
    if (!repairedMetadata) return;
    const repairedText = JSON.stringify(repairedMetadata, null, 2);
    // Add current version to history for undo
    setHistory((prev) => [...prev, jsonText]);
    setJsonText(repairedText);
    validateJson(repairedText);
    setAiSuggestions([]);
    setRepairedMetadata(null);
    toast.success('Repairs applied successfully!');
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setJsonText(previous);
      validateJson(previous);
      setHistory((prev) => prev.slice(0, -1));
      toast.info('Undone last change');
    }
  };

  if (isMetadataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading active metadata...</p>
      </div>
    );
  }

  const hasSuggestions = aiSuggestions.length > 0;
  const isSaveDisabled = !!parseError || (validationResult && !validationResult.isValid) || saveMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href={`/apps/${appId}`}><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">JSON Metadata Builder</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Edit and declare frontend/backend properties for this application</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8">
              <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={runAiAnalysis}
            disabled={isAnalyzing}
            className="h-8 border-zinc-200 text-zinc-800 bg-white hover:bg-zinc-50 hover:text-zinc-950"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Bot className="w-3.5 h-3.5 mr-1" />
            )}
            Analyze Schema
          </Button>
        </div>
      </div>

      {/* Editor & AI split screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* JSON Code Editor Column */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-border shadow-sm overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" /> app.metadata.json
              </span>
              {parseError ? (
                <Badge variant="destructive" className="text-[10px]">Invalid JSON</Badge>
              ) : validationResult?.isValid === false ? (
                <Badge variant="destructive" className="text-[10px]">Schema Errors</Badge>
              ) : (
                <Badge variant="success" className="text-[10px]">Schema Valid</Badge>
              )}
            </div>
            <CardContent className="p-0">
              <textarea
                value={jsonText}
                onChange={handleJsonChange}
                placeholder="Enter app metadata JSON definition..."
                className="w-full h-[550px] p-4 font-mono text-sm bg-background/60 focus:outline-none resize-y border-0 min-h-[400px]"
                spellCheck="false"
              />
            </CardContent>
          </Card>

          {/* Release / Publish details */}
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Release Version</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="changelog">Changelog Description *</Label>
                  <Input
                    id="changelog"
                    placeholder="e.g. Added Employee status select field and customer list workflow"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Describe what changed in this version. This creates a release and automatically compiles the active database configuration at runtime.</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/apps/${appId}`}>Discard</Link>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isSaveDisabled || !changelog.trim()}
                    onClick={handleSave}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Save className="w-4 h-4 mr-1.5" />
                    )}
                    Save Release
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Validation / AI Assistant Column */}
        <div className="lg:col-span-4 space-y-4">
          {/* AI Schema Health suggestions */}
          <Card className="border border-zinc-200 bg-white relative overflow-hidden transition-all duration-150 shadow-none">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-200/50">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm flex-1">AI Schema Assistant</h3>
                {hasSuggestions && (
                  <Button size="xs" variant="outline" onClick={applyRepairs} className="h-6 text-[10px] bg-white text-zinc-800 hover:bg-zinc-50 border-zinc-200">
                    Auto-Repair All
                  </Button>
                )}
              </div>

              {hasSuggestions ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {aiSuggestions.map((sug, i) => (
                    <div key={i} className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 space-y-2">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <p className="text-xs font-semibold text-foreground leading-tight">{sug.message}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{sug.path}</p>
                        </div>
                      </div>
                      <div className="text-[10px] bg-muted/60 p-2 rounded border border-border font-mono overflow-x-auto whitespace-pre">
                        Suggest: {JSON.stringify(sug.suggestedValue, null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
                  <Bot className="w-10 h-10 text-muted-foreground/35 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                    Click &quot;Analyze Schema&quot; above to scan metadata for errors, optimization advice, and smart field proposals.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Logs */}
          <Card className="border-border bg-card">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Schema Diagnostics</h3>

              {parseError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold">JSON Parsing Error</p>
                    <p className="text-[11px] font-mono whitespace-pre-wrap leading-tight">{parseError}</p>
                  </div>
                </div>
              )}

              {validationResult && !validationResult.isValid && validationResult.errors && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-bold mb-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Invalid Structure ({validationResult.errors.length})
                  </div>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="p-2.5 rounded bg-destructive/5 border border-destructive/10 text-xs">
                        <p className="font-semibold text-[11px] font-mono text-destructive">
                          Path: {err.path || 'root'}
                        </p>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{err.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult && validationResult.isValid && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/5 border border-success/10 text-success text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">Diagnostics passed</p>
                    <p className="text-[10px] text-muted-foreground">The metadata fits the app runtime contract perfectly.</p>
                  </div>
                </div>
              )}

              {!parseError && !validationResult && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Start typing to validate schema.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

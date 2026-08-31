'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Download, FunctionSquare,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Type,
} from 'lucide-react';

// --- Column utilities ---
const COL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const COL_LETTERS_EXT = [
  ...COL_LETTERS,
  ...COL_LETTERS.map(a => a + 'A'),
  ...COL_LETTERS.map(a => a + 'B'),
];

type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  textColor?: string;
  bgColor?: string;
};

interface SheetData {
  cells: Record<string, string>;
  formats: Record<string, CellFormat>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
}

const DEFAULT_SHEET: SheetData = { cells: {}, formats: {}, colWidths: {}, rowHeights: {} };

const ROW_COUNT = 200;
const COL_COUNT = 26;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const ROW_NUM_WIDTH = 48;
const DEFAULT_COL_WIDTH = 100;
const BUFFER_ROWS = 20;

// --- Safe math evaluator (no new Function / eval) ---
function safeEval(expr: string): number {
  const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
  if (!/^\s*[0-9+\-*/().%\s]+\s*$/.test(sanitized) || sanitized.trim().length === 0) return NaN;
  // Recursive descent parser for basic arithmetic
  let pos = 0;
  function parseExpr(): number {
    let result = parseTerm();
    while (pos < sanitized.length) {
      const ch = sanitized[pos];
      if (ch === '+' || ch === '-') { pos++; result += parseTerm(); }
      else break;
    }
    return result;
  }
  function parseTerm(): number {
    let result = parseFactor();
    while (pos < sanitized.length) {
      const ch = sanitized[pos];
      if (ch === '*' || ch === '/') {
        pos++;
        const right = parseFactor();
        result = ch === '*' ? result * right : (right !== 0 ? result / right : NaN);
      } else if (ch === '%') {
        pos++;
        result = result / 100;
      } else break;
    }
    return result;
  }
  function parseFactor(): number {
    skipSpaces();
    if (pos < sanitized.length && sanitized[pos] === '(') {
      pos++; // skip (
      const result = parseExpr();
      skipSpaces();
      if (pos < sanitized.length && sanitized[pos] === ')') pos++; // skip )
      return result;
    }
    if (pos < sanitized.length && (sanitized[pos] === '-' || sanitized[pos] === '+')) {
      const sign = sanitized[pos] === '-' ? -1 : 1;
      pos++;
      return sign * parseFactor();
    }
    return parseNumber();
  }
  function parseNumber(): number {
    skipSpaces();
    const start = pos;
    while (pos < sanitized.length && /[0-9.]/.test(sanitized[pos])) pos++;
    const numStr = sanitized.slice(start, pos);
    return numStr.length > 0 ? parseFloat(numStr) : 0;
  }
  function skipSpaces() {
    while (pos < sanitized.length && sanitized[pos] === ' ') pos++;
  }
  try {
    const result = parseExpr();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

export default function SheetEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [data, setData] = useState<SheetData>(DEFAULT_SHEET);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedCell, setSelectedCell] = useState('A1');
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [scrollRow, setScrollRow] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Load content
  useEffect(() => {
    if (!openFile) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
          headers: { 'x-zboxy-token': token },
        });
        if (res.ok) {
          const d = await res.json();
          if (d.content) {
            try {
              const parsed = JSON.parse(d.content);
              // Support both old format (flat Record) and new format (SheetData)
              if (parsed.cells) setData(parsed);
              else setData({ ...DEFAULT_SHEET, cells: parsed });
            } catch { setData(DEFAULT_SHEET); }
          }
        }
      } catch { toast.error('Failed to load spreadsheet'); }
    };
    load();
  }, [openFile, token]);

  // Auto-save
  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content: JSON.stringify(data) }),
      });
      if (res.ok) { setDirty(false); }
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }, [openFile, saving, data, token]);

  useEffect(() => {
    if (dirty) { const t = setTimeout(saveContent, 2000); return () => clearTimeout(t); }
  }, [dirty, saveContent]);

  // Track viewport for virtualization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setViewportHeight(entry.contentRect.height);
    });
    observer.observe(container);
    const handleScroll = () => {
      setScrollRow(Math.max(0, Math.floor(container.scrollTop / ROW_HEIGHT) - BUFFER_ROWS));
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Formula evaluator with caching
  const evalCache = useRef<Record<string, string>>({});
  useEffect(() => { evalCache.current = {}; }, [data.cells]);

  const evaluateCell = useCallback((cellKey: string, visited = new Set<string>()): string => {
    if (evalCache.current[cellKey] !== undefined) return evalCache.current[cellKey];
    if (visited.has(cellKey)) { evalCache.current[cellKey] = '#CIRCULAR'; return '#CIRCULAR'; }
    visited.add(cellKey);
    const val = data.cells[cellKey];
    if (!val) { evalCache.current[cellKey] = ''; return ''; }
    if (!val.startsWith('=')) { evalCache.current[cellKey] = val; return val; }
    try {
      let expr = val.slice(1).trim();
      // Replace cell references and ranges
      expr = expr.replace(/([A-Z]+\d+):([A-Z]+\d+)/gi, (_, start, end) => {
        const cells = expandRange(start.toUpperCase(), end.toUpperCase());
        return cells.map(c => evaluateCell(c, new Set(visited))).join(',');
      });
      expr = expr.replace(/([A-Z]+\d+)/gi, (match) => {
        const v = evaluateCell(match.toUpperCase(), new Set(visited));
        return v ? String(parseFloat(v) || 0) : '0';
      });
      // Functions
      expr = expr.replace(/SUM\(([^)]+)\)/gi, (_, args) => {
        const nums = args.split(',').map(s => parseFloat(s.trim()) || 0);
        return String(nums.reduce((a, b) => a + b, 0));
      });
      expr = expr.replace(/AVG\(([^)]+)\)/gi, (_, args) => {
        const nums = args.split(',').map(s => parseFloat(s.trim()) || 0);
        return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '0';
      });
      expr = expr.replace(/MAX\(([^)]+)\)/gi, (_, args) => {
        const nums = args.split(',').map(s => parseFloat(s.trim()) || 0);
        return String(Math.max(...nums));
      });
      expr = expr.replace(/MIN\(([^)]+)\)/gi, (_, args) => {
        const nums = args.split(',').map(s => parseFloat(s.trim()) || 0);
        return String(Math.min(...nums));
      });
      expr = expr.replace(/COUNT\(([^)]+)\)/gi, (_, args) => {
        const nums = args.split(',').map(s => parseFloat(s.trim()));
        return String(nums.filter(n => !isNaN(n)).length);
      });
      const result = safeEval(expr);
      const out = isNaN(result) ? '#ERROR' : String(result);
      evalCache.current[cellKey] = out;
      return out;
    } catch { evalCache.current[cellKey] = '#ERROR'; return '#ERROR'; }
  }, [data.cells]);

  const expandRange = (start: string, end: string): string[] => {
    const sc = COL_LETTERS_EXT.indexOf(start.replace(/\d+/, ''));
    const ec = COL_LETTERS_EXT.indexOf(end.replace(/\d+/, ''));
    const sr = parseInt(start.replace(/\D+/, ''));
    const er = parseInt(end.replace(/\D+/, ''));
    const cells: string[] = [];
    for (let r = sr; r <= er; r++) for (let c = sc; c <= ec; c++) cells.push(COL_LETTERS_EXT[c] + r);
    return cells;
  };

  // Get selection range for status bar
  const selectionRange = useMemo(() => {
    const end = selectionEnd || selectedCell;
    const sc = COL_LETTERS_EXT.indexOf(selectedCell.replace(/\d+/, ''));
    const ec = COL_LETTERS_EXT.indexOf(end.replace(/\d+/, ''));
    const sr = parseInt(selectedCell.replace(/\D+/, ''));
    const er = parseInt(end.replace(/\D+/, ''));
    const minC = Math.min(sc, ec), maxC = Math.max(sc, ec);
    const minR = Math.min(sr, er), maxR = Math.max(sr, er);
    return { minC, maxC, minR, maxR, sc, ec, sr, er };
  }, [selectedCell, selectionEnd]);

  const isCellSelected = useCallback((col: number, row: number) => {
    const { minC, maxC, minR, maxR } = selectionRange;
    return col >= minC && col <= maxC && row >= minR && row <= maxR;
  }, [selectionRange]);

  const isInPrimarySelection = (cellKey: string) => cellKey === selectedCell;

  // Navigation
  const parseCell = (cellKey: string) => {
    const col = COL_LETTERS_EXT.indexOf(cellKey.replace(/\d+/, '').toUpperCase());
    const row = parseInt(cellKey.replace(/\D+/, ''));
    return { col, row };
  };

  const makeCellKey = (col: number, row: number) => COL_LETTERS_EXT[col] + row;

  const moveSelection = (dc: number, dr: number) => {
    const { col, row } = parseCell(selectedCell);
    const nc = Math.max(0, Math.min(COL_COUNT - 1, col + dc));
    const nr = Math.max(1, Math.min(ROW_COUNT, row + dr));
    const nk = makeCellKey(nc, nr);
    setSelectedCell(nk);
    setSelectionEnd(null);
    setFormulaBarValue(data.cells[nk] || '');
  };

  const commitEdit = useCallback((value?: string) => {
    const val = value ?? editValue;
    const cellKey = editingCell || selectedCell;
    if (val !== undefined && val !== data.cells[cellKey]) {
      setData(prev => ({ ...prev, cells: { ...prev.cells, [cellKey]: val } }));
      setDirty(true);
    }
    setEditingCell(null);
    setFormulaBarValue(val || '');
  }, [editingCell, selectedCell, editValue, data.cells]);

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) {
      if (e.key === 'Enter') { commitEdit(); moveSelection(0, 1); e.preventDefault(); }
      else if (e.key === 'Tab') { commitEdit(); moveSelection(e.shiftKey ? -1 : 1, 0); e.preventDefault(); }
      else if (e.key === 'Escape') { setEditingCell(null); }
      return;
    }
    if (e.key === 'ArrowUp') { moveSelection(0, -1); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { moveSelection(0, 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { moveSelection(-1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'Tab') { moveSelection(1, 0); e.preventDefault(); }
    else if (e.key === 'Enter') { setEditingCell(selectedCell); setEditValue(data.cells[selectedCell] || ''); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (data.cells[selectedCell]) {
        setData(prev => { const next = { ...prev, cells: { ...prev.cells } }; delete next.cells[selectedCell]; return next; });
        setDirty(true); setFormulaBarValue('');
      }
    }
    else if (e.key === 'F2') { setEditingCell(selectedCell); setEditValue(data.cells[selectedCell] || ''); e.preventDefault(); }
  };

  // Formula bar keyboard
  const handleFormulaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { commitEdit(formulaBarValue); moveSelection(0, 1); e.preventDefault(); }
    else if (e.key === 'Escape') { setFormulaBarValue(data.cells[selectedCell] || ''); }
  };

  // Cell click / double-click
  const handleCellClick = (cellKey: string, e?: React.MouseEvent) => {
    if (e?.shiftKey) { setSelectionEnd(cellKey); }
    else { setSelectedCell(cellKey); setSelectionEnd(null); }
    setEditingCell(null);
    setFormulaBarValue(data.cells[cellKey] || '');
  };

  const handleCellDoubleClick = (cellKey: string) => {
    setEditingCell(cellKey);
    setEditValue(data.cells[cellKey] || '');
  };

  // Format toggles
  const toggleFormat = (prop: keyof CellFormat, value?: string | boolean) => {
    const fmt = data.formats[selectedCell] || {};
    const current = fmt[prop];
    const newVal = value !== undefined ? value : !current;
    setData(prev => ({
      ...prev,
      formats: { ...prev.formats, [selectedCell]: { ...fmt, [prop]: newVal } },
    }));
    setDirty(true);
  };

  // Virtualized row range
  const visibleRowCount = Math.ceil(viewportHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
  const startRow = Math.max(0, scrollRow);
  const endRow = Math.min(ROW_COUNT, startRow + visibleRowCount);

  // CSV export
  const handleDownload = () => {
    let csv = '';
    for (let r = 1; r <= ROW_COUNT; r++) {
      const row: string[] = [];
      for (let c = 0; c < COL_COUNT; c++) {
        const cellKey = COL_LETTERS_EXT[c] + r;
        const val = evaluateCell(cellKey);
        row.push(val.includes(',') ? `"${val}"` : val);
      }
      csv += row.join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = openFile?.name.replace(/\.zsheet$/, '.csv') || 'spreadsheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Selection summary (SUM, AVG, COUNT)
  const selectionSummary = useMemo(() => {
    const { minC, maxC, minR, maxR } = selectionRange;
    if (minC === maxC && minR === maxR) return null;
    const nums: number[] = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const v = evaluateCell(makeCellKey(c, r));
        const n = parseFloat(v);
        if (!isNaN(n)) nums.push(n);
      }
    }
    if (nums.length === 0) return null;
    return { count: nums.length, sum: nums.reduce((a, b) => a + b, 0), avg: nums.reduce((a, b) => a + b, 0) / nums.length };
  }, [selectionRange, evaluateCell]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveContent(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveContent]);

  if (!openFile) return null;

  const totalWidth = ROW_NUM_WIDTH + COL_LETTERS.slice(0, COL_COUNT).reduce((sum, _, i) => sum + (data.colWidths[i] || DEFAULT_COL_WIDTH), 0);

  return (
    <div className="h-screen flex flex-col bg-white" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeFile}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{openFile.name}</h1>
        </div>
        <span className={`text-xs mr-1 ${dirty ? 'text-amber-500' : 'text-slate-400'}`}>{saving ? 'Saving...' : dirty ? 'Unsaved' : 'Saved'}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Export CSV"><Download className="w-4 h-4" /></Button>
        <Button onClick={saveContent} disabled={saving || !dirty} size="sm" className="gap-1.5 h-8"><Save className="w-3.5 h-3.5" /> Save</Button>
      </div>

      {/* Format toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1 border-b bg-slate-50 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('bold')} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('italic')} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('align', 'left')} title="Align Left">
          <AlignLeft className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('align', 'center')} title="Center">
          <AlignCenter className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('align', 'right')} title="Align Right">
          <AlignRight className="w-3.5 h-3.5" />
        </Button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFormat('textColor', '#dc2626')} title="Text Color">
          <Type className="w-3.5 h-3.5 text-red-600" />
        </Button>
        <div className="flex-1" />
        <FunctionSquare className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">SUM, AVG, MAX, MIN, COUNT</span>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b bg-white shrink-0">
        <div className="w-14 h-7 text-xs font-mono font-semibold text-slate-600 bg-slate-100 border rounded flex items-center justify-center shrink-0">
          {selectedCell}
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <span className="text-slate-400 text-lg font-light shrink-0">fx</span>
        <input
          ref={formulaInputRef}
          className="flex-1 h-7 text-sm font-mono outline-none border-none bg-transparent"
          placeholder="Enter value or formula (e.g. =SUM(A1:A10))"
          value={editingCell ? editValue : formulaBarValue}
          onChange={(e) => {
            if (!editingCell) setEditingCell(selectedCell);
            setEditValue(e.target.value);
            setFormulaBarValue(e.target.value);
          }}
          onKeyDown={handleFormulaKeyDown}
          onFocus={() => {
            if (!editingCell) { setEditingCell(selectedCell); setEditValue(data.cells[selectedCell] || ''); }
          }}
        />
      </div>

      {/* Spreadsheet grid */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div style={{ width: totalWidth, height: ROW_COUNT * ROW_HEIGHT, position: 'relative' }}>
          {/* Column headers */}
          <div className="sticky top-0 z-20 flex" style={{ height: HEADER_HEIGHT }}>
            <div className="sticky left-0 z-30 bg-slate-100 border-r border-b w-[48px] shrink-0" />
            {COL_LETTERS.slice(0, COL_COUNT).map((letter, i) => (
              <div
                key={letter}
                className="bg-slate-100 border-r border-b text-xs font-medium text-slate-500 flex items-center justify-center select-none shrink-0 hover:bg-slate-200 cursor-col-resize"
                style={{ width: data.colWidths[i] || DEFAULT_COL_WIDTH }}
              >
                {letter}
              </div>
            ))}
          </div>
          {/* Rows (virtualized) */}
          <div style={{ position: 'absolute', top: HEADER_HEIGHT, left: 0, right: 0, bottom: 0 }}>
            {Array.from({ length: endRow - startRow }, (_, i) => {
              const r = startRow + i + 1;
              if (r > ROW_COUNT) return null;
              return (
                <div key={r} className="flex" style={{ height: ROW_HEIGHT }}>
                  {/* Row number */}
                  <div
                    className="sticky left-0 z-10 bg-slate-50 border-r border-b text-xs text-right pr-2 text-slate-500 font-medium flex items-center justify-end select-none shrink-0"
                    style={{ width: ROW_NUM_WIDTH }}
                  >
                    {r}
                  </div>
                  {/* Cells */}
                  {COL_LETTERS.slice(0, COL_COUNT).map((letter, c) => {
                    const cellKey = letter + r;
                    const isSelected = isInPrimarySelection(cellKey);
                    const inRange = !isSelected && isCellSelected(c, r);
                    const isEditing = cellKey === editingCell;
                    const rawVal = data.cells[cellKey];
                    const displayVal = isEditing ? editValue : (rawVal?.startsWith('=') ? evaluateCell(cellKey) : rawVal || '');
                    const isError = displayVal === '#ERROR' || displayVal === '#CIRCULAR';
                    const isFormula = rawVal?.startsWith('=');
                    const isNumber = isFormula && !isNaN(parseFloat(displayVal)) && displayVal !== '';
                    const fmt = data.formats[cellKey];
                    const colWidth = data.colWidths[c] || DEFAULT_COL_WIDTH;

                    let className = 'border-r border-b relative cursor-cell transition-colors ';
                    if (isSelected) className += 'outline outline-2 outline-blue-500 z-[5] bg-white ';
                    else if (inRange) className += 'bg-blue-50 ';
                    else className += 'hover:bg-slate-50 ';

                    let textClassName = 'block px-1.5 py-0.5 text-[13px] truncate ';
                    if (isError) textClassName += 'text-red-500 ';
                    else if (isNumber) textClassName += 'text-right text-blue-700 tabular-nums ';
                    else textClassName += 'text-slate-700 ';
                    if (fmt?.bold) textClassName += 'font-semibold ';
                    if (fmt?.italic) textClassName += 'italic ';
                    if (fmt?.align) textClassName += `text-${fmt.align} `;

                    return (
                      <td
                        key={c}
                        className={className}
                        style={{ width: colWidth, minWidth: colWidth, height: ROW_HEIGHT }}
                        onClick={(e) => handleCellClick(cellKey, e)}
                        onDoubleClick={() => handleCellDoubleClick(cellKey)}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            className="absolute inset-0 w-full h-full px-1.5 text-[13px] border-none outline-none bg-white z-10 font-mono"
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); setFormulaBarValue(e.target.value); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { commitEdit(); moveSelection(0, 1); e.preventDefault(); }
                              else if (e.key === 'Tab') { commitEdit(); moveSelection(e.shiftKey ? -1 : 1, 0); e.preventDefault(); }
                              else if (e.key === 'Escape') { setEditingCell(null); }
                            }}
                            onBlur={() => commitEdit()}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={textClassName}
                            style={{
                              color: isError ? undefined : fmt?.textColor || undefined,
                              backgroundColor: fmt?.bgColor || undefined,
                            }}
                          >
                            {displayVal}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-slate-50 text-xs text-slate-500 shrink-0">
        <span>{selectedCell}</span>
        {selectionSummary && (
          <div className="flex gap-4">
            <span>Sum: <b>{selectionSummary.sum.toLocaleString()}</b></span>
            <span>Avg: <b>{selectionSummary.avg.toFixed(2)}</b></span>
            <span>Count: <b>{selectionSummary.count}</b></span>
          </div>
        )}
        <span>{ROW_COUNT} rows × {COL_COUNT} cols</span>
      </div>
    </div>
  );
}

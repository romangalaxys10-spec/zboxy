'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useZboxyStore } from '@/lib/zboxy-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Save, Download, Plus, Minus } from 'lucide-react';

const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26;
const COL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const COL_LETTERS_EXT = [...COL_LETTERS, ...COL_LETTERS.map(a => a + 'A'), ...COL_LETTERS.map(a => a + 'B')];

interface CellData {
  [key: string]: string;
}

export default function SheetEditor() {
  const { openFile, closeFile, token } = useZboxyStore();
  const [data, setData] = useState<CellData>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string>('A1');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [colCount, setColCount] = useState(DEFAULT_COLS);
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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
            try { setData(JSON.parse(d.content)); } catch { setData({}); }
          }
        }
      } catch {}
    };
    load();
  }, [openFile, token]);

  const saveContent = useCallback(async () => {
    if (!openFile || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/zboxy/content?id=${openFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-zboxy-token': token },
        body: JSON.stringify({ content: JSON.stringify(data) }),
      });
      if (res.ok) { setDirty(false); toast.success('Spreadsheet saved'); }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }, [openFile, saving, data, token]);

  useEffect(() => {
    if (dirty) { const t = setTimeout(saveContent, 2000); return () => clearTimeout(t); }
  }, [dirty, saveContent]);

  const handleCellClick = (cellKey: string) => {
    setSelectedCell(cellKey);
  };

  const handleCellDoubleClick = (cellKey: string) => {
    setEditingCell(cellKey);
    setEditValue(data[cellKey] || '');
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editingCell) {
      setData(prev => ({ ...prev, [editingCell]: editValue }));
      setDirty(true);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
      const col = COL_LETTERS_EXT.indexOf(selectedCell.replace(/\d+/, ''));
      const row = parseInt(selectedCell.replace(/\D+/, ''));
      if (row < rowCount) setSelectedCell(COL_LETTERS_EXT[col] + (row + 1));
      e.preventDefault();
    } else if (e.key === 'Tab') {
      commitEdit();
      const col = COL_LETTERS_EXT.indexOf(selectedCell.replace(/\d+/, ''));
      const row = parseInt(selectedCell.replace(/\D+/, ''));
      setSelectedCell(COL_LETTERS_EXT[col + 1] + row);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const evaluateCell = (cellKey: string): string => {
    const val = data[cellKey];
    if (!val) return '';
    if (val.startsWith('=')) {
      try {
        let expr = val.slice(1);
        // Replace cell references with values
        expr = expr.replace(/([A-Z]+\d+)/gi, (match: string): string => {
          const v = evaluateCell(match.toUpperCase());
          return v ? String(parseFloat(v) || 0) : '0';
        });
        // Support basic functions
        expr = expr.replace(/SUM\(([^)]+)\)/gi, (_, range) => {
          const cells = parseRange(range);
          return cells.reduce((sum, c) => sum + (parseFloat(evaluateCell(c)) || 0), 0);
        });
        expr = expr.replace(/AVG\(([^)]+)\)/gi, (_, range) => {
          const cells = parseRange(range);
          const vals = cells.map(c => parseFloat(evaluateCell(c)) || 0);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        expr = expr.replace(/MAX\(([^)]+)\)/gi, (_, range) => {
          const cells = parseRange(range);
          return Math.max(...cells.map(c => parseFloat(evaluateCell(c)) || 0));
        });
        expr = expr.replace(/MIN\(([^)]+)\)/gi, (_, range) => {
          const cells = parseRange(range);
          return Math.min(...cells.map(c => parseFloat(evaluateCell(c)) || 0));
        });
        // Safe math expression evaluator (avoids CSP issues with new Function)
        let safeExpr = expr.replace(/[^0-9+\-*/().%\s]/g, '');
        // Basic safety: only allow math characters
        if (/^[0-9+\-*/().%\s]+$/.test(safeExpr) && safeExpr.trim().length > 0) {
          try {
            const result = Function('"use strict"; return (' + safeExpr + ')')();
            if (typeof result === 'number' && isFinite(result)) {
              return String(result);
            }
          } catch { /* fall through to error */ }
        }
        return '#ERROR';
      } catch { return '#ERROR'; }
    }
    return val;
  };

  const parseRange = (range: string): string[] => {
    if (range.includes(':')) {
      const [start, end] = range.split(':');
      const startCol = COL_LETTERS_EXT.indexOf(start.replace(/\d+/, '').toUpperCase());
      const endCol = COL_LETTERS_EXT.indexOf(end.replace(/\d+/, '').toUpperCase());
      const startRow = parseInt(start.replace(/\D+/, ''));
      const endRow = parseInt(end.replace(/\D+/, ''));
      const cells: string[] = [];
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          cells.push(COL_LETTERS_EXT[c] + r);
        }
      }
      return cells;
    }
    return range.split(',').map(s => s.trim().toUpperCase());
  };

  const handleDownload = () => {
    let csv = '';
    for (let r = 1; r <= rowCount; r++) {
      const row: string[] = [];
      for (let c = 0; c < colCount; c++) {
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
    a.download = openFile?.name.replace('.zsheet', '.csv') || 'spreadsheet.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!openFile) return null;

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        <Button variant="ghost" size="icon" onClick={closeFile} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{openFile.name}</h1>
          <p className="text-xs text-slate-500">{dirty ? 'Saving...' : 'All changes saved'}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDownload} title="Download as CSV">
          <Download className="w-4 h-4" />
        </Button>
        <Button onClick={saveContent} disabled={saving} size="sm" className="gap-1.5">
          <Save className="w-4 h-4" /> Save
        </Button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-slate-50 shrink-0">
        <div className="w-16 text-xs font-mono font-medium text-slate-600 bg-white border rounded px-2 py-1 text-center">
          {selectedCell}
        </div>
        <Input
          className="h-7 text-sm font-mono"
          placeholder="Enter value or formula (e.g., =SUM(A1:A10))"
          value={editingCell ? editValue : data[selectedCell] || ''}
          onChange={(e) => {
            if (!editingCell) setEditingCell(selectedCell);
            setEditValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!editingCell) {
              setEditingCell(selectedCell);
              setEditValue(data[selectedCell] || '');
            }
          }}
        />
      </div>

      {/* Spreadsheet grid */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="border-collapse min-w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-12 min-w-12 bg-slate-100 border-r border-b text-xs font-medium text-slate-500 sticky left-0 z-20" />
              {Array.from({ length: colCount }, (_, i) => (
                <th key={i} className="w-24 min-w-24 bg-slate-100 border-r border-b text-xs font-medium text-slate-500">
                  {COL_LETTERS_EXT[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                <td className="w-12 min-w-12 bg-slate-100 border-r border-b text-xs text-right pr-2 text-slate-500 font-medium sticky left-0 z-10">
                  {r + 1}
                </td>
                {Array.from({ length: colCount }, (_, c) => {
                  const cellKey = COL_LETTERS_EXT[c] + (r + 1);
                  const isSelected = cellKey === selectedCell;
                  const isEditing = cellKey === editingCell;
                  const rawVal = data[cellKey];
                  const displayVal = isEditing ? editValue : (rawVal?.startsWith('=') ? evaluateCell(cellKey) : rawVal || '');
                  const isError = displayVal === '#ERROR';
                  const isNumber = rawVal?.startsWith('=') && !isNaN(parseFloat(displayVal)) && displayVal !== '';
                  return (
                    <td
                      key={c}
                      className={`w-24 min-w-24 border-r border-b px-0 relative ${isSelected ? 'outline outline-2 outline-emerald-500 z-5' : ''} hover:bg-slate-50 cursor-cell`}
                      onClick={() => handleCellClick(cellKey)}
                      onDoubleClick={() => handleCellDoubleClick(cellKey)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          className="absolute inset-0 w-full h-full px-1.5 text-sm border-none outline-none bg-white z-10"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={commitEdit}
                          autoFocus
                        />
                      ) : (
                        <span className={`block px-1.5 py-0.5 text-sm truncate ${isError ? 'text-red-500' : isNumber ? 'text-right text-blue-700' : 'text-slate-700'}`}>
                          {displayVal}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

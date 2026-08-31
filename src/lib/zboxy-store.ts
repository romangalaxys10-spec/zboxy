import { create } from 'zustand';

export interface ZboxyUser {
  id: string;
  name: string;
  token: string;
}

export interface ZboxyFile {
  id: string;
  userId: string;
  name: string;
  type: 'file' | 'folder';
  mimeType: string | null;
  size: number;
  path: string;
  parentId: string | null;
  starred: boolean;
  trashed: boolean;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'grid' | 'list';
export type ActiveView = 'drive' | 'starred' | 'trash' | 'recent';
export type EditorType = 'doc' | 'sheet' | 'slide' | null;

interface ZboxyState {
  user: ZboxyUser | null;
  token: string;
  setToken: (t: string) => void;
  setUser: (u: ZboxyUser) => void;
  logout: () => void;

  files: ZboxyFile[];
  setFiles: (f: ZboxyFile[]) => void;

  currentPath: string;
  setCurrentPath: (p: string) => void;

  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;

  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  selectedFiles: string[];
  setSelectedFiles: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  openFileId: string | null;
  openFile: ZboxyFile | null;
  editorType: EditorType;
  openFileForEdit: (file: ZboxyFile) => void;
  closeFile: () => void;

  detailPanelOpen: boolean;
  setDetailPanelOpen: (open: boolean) => void;
  detailFile: ZboxyFile | null;
  setDetailFile: (f: ZboxyFile | null) => void;

  contextMenu: { x: number; y: number; fileId: string } | null;
  setContextMenu: (m: { x: number; y: number; fileId: string } | null) => void;

  newFileDialog: boolean;
  setNewFileDialog: (open: boolean) => void;
  renameDialog: { open: boolean; fileId: string; name: string } | null;
  setRenameDialog: (d: { open: boolean; fileId: string; name: string } | null) => void;

  loading: boolean;
  setLoading: (l: boolean) => void;
}

export const useZboxyStore = create<ZboxyState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('zboxy_token') || '' : '',
  setToken: (t) => {
    localStorage.setItem('zboxy_token', t);
    set({ token: t });
  },
  setUser: (u) => set({ user: u }),
  logout: () => {
    localStorage.removeItem('zboxy_token');
    set({ user: null, token: '', files: [], currentPath: '/', activeView: 'drive', searchQuery: '', selectedFiles: [], openFileId: null, openFile: null, editorType: null });
  },

  files: [],
  setFiles: (f) => set({ files: f }),

  currentPath: '/',
  setCurrentPath: (p) => set({ currentPath: p, selectedFiles: [] }),

  activeView: 'drive',
  setActiveView: (v) => set({ activeView: v, currentPath: '/', selectedFiles: [], searchQuery: '' }),

  viewMode: 'grid',
  setViewMode: (v) => set({ viewMode: v }),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  selectedFiles: [],
  setSelectedFiles: (ids) => set({ selectedFiles: ids }),
  toggleSelect: (id) => {
    const sel = get().selectedFiles;
    if (sel.includes(id)) {
      set({ selectedFiles: sel.filter((s) => s !== id) });
    } else {
      set({ selectedFiles: [...sel, id] });
    }
  },
  clearSelection: () => set({ selectedFiles: [] }),

  openFileId: null,
  openFile: null,
  editorType: null,
  openFileForEdit: (file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let editorType: EditorType = null;
    if (['zdoc'].includes(ext || '')) editorType = 'doc';
    else if (['zsheet'].includes(ext || '')) editorType = 'sheet';
    else if (['zslide'].includes(ext || '')) editorType = 'slide';
    set({ openFileId: file.id, openFile: file, editorType });
  },
  closeFile: () => set({ openFileId: null, openFile: null, editorType: null }),

  detailPanelOpen: false,
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  detailFile: null,
  setDetailFile: (f) => set({ detailFile: f, detailPanelOpen: !!f }),

  contextMenu: null,
  setContextMenu: (m) => set({ contextMenu: m }),

  newFileDialog: false,
  setNewFileDialog: (open) => set({ newFileDialog: open }),
  renameDialog: null,
  setRenameDialog: (d) => set({ renameDialog: d }),

  loading: false,
  setLoading: (l) => set({ loading: l }),
}));

import type { Extension } from '@codemirror/state'
import type { ComputedRef, MaybeRefOrGetter, Ref, ShallowRef } from 'vue'

export type CellType = 'code' | 'markdown' | 'raw'
export type NotebookCellType = CellType
export type KernelStatus = 'loading' | 'ready' | 'busy' | 'error'
export type KernelUpdateMode = 'after-execution' | 'always-live'
export type NotebookMode = 'command' | 'edit'
export type NotebookMetadata = Record<string, unknown>
export type WorkspaceState = Record<string, unknown>
export type ThemeVariables = Record<string, string>

export interface OutputMimeBundle {
  [mimeType: string]: unknown
}

export type MimeBundle = OutputMimeBundle

export interface StreamOutput {
  output_type: 'stream'
  name: string
  text: string
  data?: OutputMimeBundle
}

export interface ExecuteResultOutput {
  output_type: 'execute_result'
  data: OutputMimeBundle
  metadata: NotebookMetadata
  execution_count: number | null
}

export interface DisplayDataOutput {
  output_type: 'display_data'
  data: OutputMimeBundle
  metadata: NotebookMetadata
}

export interface ErrorOutput {
  output_type: 'error'
  ename: string
  evalue: string
  traceback: string[]
  data?: OutputMimeBundle
}

export interface GenericOutput {
  output_type: string
  data: OutputMimeBundle
  metadata: NotebookMetadata
  name: string
  text: string
  traceback: string[]
  [key: string]: unknown
}

export interface AmbiguousOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  data: OutputMimeBundle
  metadata?: NotebookMetadata
  name?: string
  text?: string
  execution_count?: number | null
  ename?: string
  evalue?: string
  traceback: string[]
  [key: string]: unknown
}

export type CellOutput =
  | StreamOutput
  | ExecuteResultOutput
  | DisplayDataOutput
  | ErrorOutput
  | AmbiguousOutput

export interface BaseCell {
  id: string
  cell_type: CellType
  source: string
  metadata: NotebookMetadata
  [key: string]: unknown
}

export interface CodeCell extends BaseCell {
  cell_type: 'code'
  execution_count: number | null
  outputs: CellOutput[]
}

export interface MarkdownCell extends BaseCell {
  cell_type: 'markdown'
}

export interface RawCell extends BaseCell {
  cell_type: 'raw'
}

export type NotebookCell = CodeCell | MarkdownCell | RawCell

export interface NotebookDocument {
  nbformat: number
  nbformat_minor: number
  metadata: NotebookMetadata
  cells: NotebookCell[]
  [key: string]: unknown
}

export type MultilineField = string | string[]

export interface SerializedStreamOutput extends Omit<StreamOutput, 'text'> {
  text: MultilineField
}

export interface SerializedErrorOutput extends Omit<ErrorOutput, 'traceback'> {
  traceback: string[]
}

export type SerializedCellOutput =
  | SerializedStreamOutput
  | ExecuteResultOutput
  | DisplayDataOutput
  | SerializedErrorOutput
  | GenericOutput

export interface SerializedCodeCell extends Omit<CodeCell, 'source' | 'outputs'> {
  source: MultilineField
  outputs: SerializedCellOutput[]
}

export interface SerializedMarkdownCell extends Omit<MarkdownCell, 'source'> {
  source: MultilineField
}

export interface SerializedRawCell extends Omit<RawCell, 'source'> {
  source: MultilineField
}

export type SerializedNotebookCell = SerializedCodeCell | SerializedMarkdownCell | SerializedRawCell

export interface SerializedNotebookDocument extends Omit<NotebookDocument, 'cells'> {
  cells: SerializedNotebookCell[]
}

export type VuepyterModelValue = NotebookDocument | SerializedNotebookDocument

export interface CodeEditorProps {
  modelValue?: string
  language?: 'python' | 'markdown' | 'raw'
  readOnly?: boolean
  lineNumbers?: boolean
  lineWrapping?: boolean
  indentUnit?: number
  tabSize?: number
  placeholder?: string
  autofocus?: boolean
  extensions?: Extension[]
}

export interface KeymapConfig {
  runCellAndAdvance: string
  runCellAndStay: string
  runCellAndInsertBelow: string
  moveCellUp: string
  moveCellDown: string
  moveCellUpSecondary: string
  moveCellDownSecondary: string
  extendSelectionUp: string
  extendSelectionDown: string
  extendSelectionTop: string
  extendSelectionBottom: string
  moveCellUpPosition: string
  moveCellDownPosition: string
  addCellBelow: string
  addCellAbove: string
  insertHeadingAbove: string
  insertHeadingBelow: string
  deleteCell: string
  undoCellAction: string
  redoCellAction: string
  copyCell: string
  cutCell: string
  pasteCellBelow: string
  pasteCellAbove: string
  mergeCells: string
  mergeCellAbove: string
  mergeCellBelow: string
  changeCellToCode: string
  changeCellToMarkdown: string
  changeCellToRaw: string
  changeCellToHeading1: string
  changeCellToHeading2: string
  changeCellToHeading3: string
  changeCellToHeading4: string
  changeCellToHeading5: string
  changeCellToHeading6: string
  enterEditMode: string
  enterCommandMode: string
  enterCommandModeSecondary: string
  collapseHeading: string
  expandHeading: string
  collapseAllHeadings: string
  expandAllHeadings: string
  selectAllCells: string
  toggleLineNumbers: string
  toggleAllLineNumbers: string
  toggleOutput: string
  toggleOutputScrolling: string
  toggleRenderSideBySide: string
  showShortcuts: string
  interruptKernel: string
  restartKernel: string
  saveCommand: string
  historyPrevious: string
  historyNext: string
  invokeCompleter: string
  showTooltip: string
  dismissTooltip: string
  splitCellAtCursor: string
  exitEditMode: string
  save: string
  runCellStay?: string
  moveCellAbove?: string
  moveCellBelow?: string
  toggleMarkdownEdit?: string
  toggleMarkdownCommand?: string
}

export interface VuepyterLocale {
  addCodeCell: string
  addMarkdownCell: string
  deleteCell: string
  runCell: string
  runAllCells: string
  restartKernel: string
  interruptKernel: string
  kernelUpdateModeAfterExecution: string
  kernelUpdateModeAlwaysLive: string
  clearAllOutputs: string
  statusLoading: string
  statusReady: string
  statusBusy: string
  statusError: string
  cellTypeCode: string
  cellTypeMarkdown: string
  cellTypeRaw: string
  [key: string]: string
}

export type VuepyterTheme = 'light' | 'dark' | ThemeVariables

export interface VuepyterProps {
  modelValue?: VuepyterModelValue | null
  pyodideUrl?: string
  pyodidePackages?: string[]
  pyodideInitCode?: string
  kernelUpdateMode?: KernelUpdateMode
  readOnly?: boolean
  showEditorBar?: boolean
  editorBarPosition?: 'top' | 'bottom'
  theme?: VuepyterTheme
  maxOutputHeight?: number
  cellTypes?: NotebookCellType[]
  autosaveInterval?: number | false
  locale?: Partial<VuepyterLocale> | Record<string, string>
  keymap?: Partial<KeymapConfig>
  editorOptions?: Partial<CodeEditorProps>
}

export interface PyodideGlobalsLike {
  toJs: (options?: Record<string, unknown>) => unknown
  set: (name: string, value: unknown) => void
}

export interface PyodideStdIOOptions {
  batched?: (output: string) => void
  raw?: (output: number | string) => void
}

export interface PyodideInterface {
  runPythonAsync: any
  setStdout: any
  setStderr: any
  interruptExecution?: any
  globals: PyodideGlobalsLike
  loadPackage?: any
  pyimport?: (name: string) => { install?: (packages: string[]) => Promise<void>; destroy?: () => void }
  [key: string]: unknown
}

export interface PyodideLoaderOptions {
  indexURL?: string
  packages?: string[]
}

export type LoadPyodideFn = (options?: PyodideLoaderOptions) => Promise<PyodideInterface>
export type LoadPyodide = LoadPyodideFn

export interface KernelReadyPayload {
  pyodide: PyodideInterface
  workspace: Ref<WorkspaceState>
}

export interface KernelErrorPayload {
  type: string
  message: string
  detail?: unknown
}

export interface KernelExecuteRequest {
  cellId?: string
  source: string
}

export interface KernelExecutePayload {
  cellId: string
  source: string
}

export interface KernelCompletePayload {
  cellId: string
  outputs: CellOutput[]
  error?: Error
}

export interface KernelWorkspaceSyncPayload {
  workspace: WorkspaceState
}

export interface KernelExecuteResult {
  cellId?: string
  outputs: CellOutput[]
  executionCount: number | null
  result?: unknown
  error?: Error
}

export interface UsePyodideKernelOptions {
  pyodideUrl?: string
  pyodidePackages?: string[]
  pyodideInitCode?: string
  getWorkspaceUpdateMode?: () => KernelUpdateMode
  onReady?: (payload: KernelReadyPayload) => void
  onError?: (payload: KernelErrorPayload) => void
  onExecute?: (payload: KernelExecutePayload) => void
  onComplete?: (payload: KernelCompletePayload) => void
  onWorkspaceSync?: (payload: KernelWorkspaceSyncPayload) => void
}

export interface UseVuepyterProvideOptions {
  pyodide: ShallowRef<PyodideInterface | null> | PyodideInterface | null
  workspace: Ref<WorkspaceState> | WorkspaceState
  status: Ref<KernelStatus> | KernelStatus
}

export interface UseNotebookModelOptions {
  modelValue?: MaybeRefOrGetter<VuepyterModelValue | null | undefined>
  allowedCellTypes?: MaybeRefOrGetter<NotebookCellType[] | undefined>
}

export interface UseNotebookModelReturn {
  notebook: Ref<NotebookDocument>
  cells: ComputedRef<NotebookCell[]>
  activeCellId: Ref<string | null>
  activeCellIndex: ComputedRef<number>
  setNotebook: (value: VuepyterModelValue | null | undefined) => void
  setActiveCellId: (cellId: string | null) => void
  setActiveCellIndex: (index: number) => void
  createCell: (cellType?: NotebookCellType, overrides?: Partial<NotebookCell>) => NotebookCell
  addCell: (index?: number, cellType?: NotebookCellType) => NotebookCell
  insertCell: (cell: NotebookCell, index?: number) => NotebookCell
  updateCell: (
    cellIdOrIndex: string | number,
    patch: Partial<NotebookCell> | ((cell: NotebookCell) => NotebookCell),
  ) => NotebookCell | null
  setCellSource: (cellIdOrIndex: string | number, source: string) => NotebookCell | null
  setCellType: (cellIdOrIndex: string | number, cellType: NotebookCellType) => NotebookCell | null
  setCellOutputs: (
    cellIdOrIndex: string | number,
    outputs: Array<Partial<CellOutput> & { output_type: string }>,
    executionCount?: number | null,
  ) => NotebookCell | null
  clearOutputs: (cellIdOrIndex?: string | number) => void
  resetExecutionState: () => void
  deleteCell: (index: number) => NotebookCell | null
  removeCell: (cellId: string) => NotebookCell | null
  moveCell: (fromIndex: number, toIndex: number) => void
  getCellById: (cellId: string) => NotebookCell | undefined
  serialize: () => SerializedNotebookDocument
  toNbformatDocument: () => SerializedNotebookDocument
}

export interface UseKeyboardOptions {
  keymap?: MaybeRefOrGetter<Partial<KeymapConfig>>
  readOnly?: MaybeRefOrGetter<boolean>
  activeCellIndex?: Ref<number>
  cellCount?: MaybeRefOrGetter<number>
  mode?: Ref<NotebookMode>
  enabled?: MaybeRefOrGetter<boolean>
  target?: MaybeRefOrGetter<EventTarget | null | undefined>
  deleteSequenceTimeout?: number
  onRunCell?: (advance: boolean) => void
  onMoveCellSelection?: (nextIndex: number) => void
  onAddCell?: (insertAt: number) => void
  onDeleteCell?: (index: number) => void
  onUndoCellAction?: () => void
  onRedoCellAction?: () => void
  onCopyCell?: (index: number) => void
  onCutCell?: (index: number) => void
  onPasteCellBelow?: (index: number) => void
  onPasteCellAbove?: (index: number) => void
  onMergeCells?: (index: number) => void
  onMergeCellAbove?: (index: number) => void
  onMergeCellBelow?: (index: number) => void
  onChangeCellType?: (payload: { index: number; type: NotebookCellType }) => void
  onSetHeadingLevel?: (payload: { index: number; level: 1 | 2 | 3 | 4 | 5 | 6 }) => void
  onEnterEditMode?: () => void
  onExitEditMode?: () => void
  onRunCellAndAdvance?: () => void
  onRunCellStay?: () => void
  onRunCellAndInsertBelow?: () => void
  onMoveCellAbove?: () => void
  onMoveCellBelow?: () => void
  onMoveCellUpPosition?: (payload: { from: number; to: number }) => void
  onMoveCellDownPosition?: (payload: { from: number; to: number }) => void
  onMoveToTop?: () => void
  onMoveToBottom?: () => void
  onExtendSelectionUp?: () => void
  onExtendSelectionDown?: () => void
  onExtendSelectionTop?: () => void
  onExtendSelectionBottom?: () => void
  onAddCellBelow?: () => void
  onAddCellAbove?: () => void
  onInsertHeadingAbove?: () => void
  onInsertHeadingBelow?: () => void
  onCollapseHeading?: () => void
  onExpandHeading?: () => void
  onCollapseAllHeadings?: () => void
  onExpandAllHeadings?: () => void
  onSelectAllCells?: () => void
  onToggleLineNumbers?: () => void
  onToggleAllLineNumbers?: () => void
  onToggleOutput?: () => void
  onToggleOutputScrolling?: () => void
  onToggleRenderSideBySide?: () => void
  onShowShortcuts?: () => void
  onInterruptKernel?: () => void
  onRestartKernel?: () => void
  onSaveCommand?: () => void
  onHistoryPrevious?: () => void
  onHistoryNext?: () => void
  onInvokeCompleter?: () => void
  onShowTooltip?: () => void
  onDismissTooltip?: () => void
  onToggleMarkdownEdit?: () => void
  onToggleMarkdownCommand?: () => void
  onSave?: () => void
}

export interface UseKeyboardReturn {
  mode: Ref<NotebookMode>
  isCommandMode: ComputedRef<boolean>
  isEditMode: ComputedRef<boolean>
  setMode: (mode: NotebookMode) => void
  handleKeydown: (event: KeyboardEvent) => void
  onKeydown: (event: KeyboardEvent) => void
}

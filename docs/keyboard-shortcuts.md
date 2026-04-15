# Vuepyter Keyboard Shortcuts

Vuepyter mirrors Jupyter Notebook keyboard behavior with command mode and edit mode.

Research sources used for this mapping:

- https://jupyterlab.readthedocs.io/en/stable/user/commands.html#notebook
- https://jupyterlab.readthedocs.io/en/stable/user/commands.html#kernel-menu
- https://jupyterlab.readthedocs.io/en/stable/user/commands.html#docmanager-save
- https://jupyter-notebook.readthedocs.io/en/v6.5.4/examples/Notebook/Notebook%20Basics.html#Keyboard-Navigation
- https://jupyter-notebook.readthedocs.io/en/v7.4.0/examples/Notebook/Notebook%20Basics.html#Keyboard-Navigation

`Ctrl` below means `Cmd` on macOS.

## Command Mode

- `Enter`: Enter edit mode
- `ArrowUp` / `K`: Select cell above
- `ArrowDown` / `J`: Select cell below
- `Shift+ArrowUp`: Extend selection up
- `Shift+ArrowDown`: Extend selection down
- `Shift+Home`: Extend selection to top
- `Shift+End`: Extend selection to bottom
- `A`: Insert cell above
- `B`: Insert cell below
- `Shift+A`: Insert heading cell above
- `Shift+B`: Insert heading cell below
- `X`: Cut cell
- `C`: Copy cell
- `V`: Paste cell below
- `Shift+V`: Paste cell above
- `D D`: Delete cell
- `Z`: Undo cell action
- `Shift+Z`: Redo cell action
- `Y`: Change to code cell
- `M`: Change to markdown cell
- `R`: Change to raw cell
- `1..6`: Change to markdown heading level
- `Shift+M`: Merge with cell below
- `Ctrl+Backspace`: Merge with cell above
- `Ctrl+Shift+M`: Merge with cell below
- `Ctrl+Shift+ArrowUp`: Move cell up
- `Ctrl+Shift+ArrowDown`: Move cell down
- `ArrowLeft`: Heading collapse/navigation action
- `ArrowRight`: Heading expand/navigation action
- `Ctrl+Shift+ArrowLeft`: Collapse all headings action
- `Ctrl+Shift+ArrowRight`: Expand all headings action
- `Ctrl+A`: Select all cells action
- `L`: Toggle line numbers for active cell
- `Shift+L`: Toggle line numbers for all cells
- `O`: Toggle output visibility for active cell
- `Shift+O`: Toggle output scrolling for active cell
- `Shift+R`: Toggle side-by-side render action
- `H`: Show shortcuts action
- `S`: Save notebook
- `I I`: Interrupt kernel
- `0 0`: Restart kernel

## Edit Mode

- `Esc`: Enter command mode
- `Ctrl+M`: Enter command mode
- `Shift+Enter`: Run cell and select next
- `Ctrl+Enter`: Run cell
- `Alt+Enter`: Run cell and insert below
- `Ctrl+Shift+-`: Split cell at cursor
- `Alt+ArrowUp`: Previous kernel history entry action
- `Alt+ArrowDown`: Next kernel history entry action
- `Tab`: Invoke completer action
- `Shift+Tab`: Show tooltip action

## Global

- `Ctrl+S`: Save notebook

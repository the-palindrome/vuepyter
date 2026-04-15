import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditorBar from '@/components/EditorBar.vue'

async function clickMenuItem(
  wrapper: any,
  menuId: 'file' | 'edit' | 'run' | 'kernel',
  itemId: string,
) {
  await wrapper.get(`[data-testid="menu-${menuId}"]`).trigger('click')
  await wrapper.get(`[data-testid="menu-item-${itemId}"]`).trigger('click')
}

describe('EditorBar', () => {
  it('renders notebook identity, menus, and kernel metadata', () => {
    const wrapper = mount(EditorBar, {
      props: {
        notebookTitle: 'Intro.ipynb',
        trusted: true,
        status: 'ready',
        kernelName: 'Python (Pyodide)',
      },
    })

    expect(wrapper.get('[data-testid="title-button"]').text()).toContain('Intro.ipynb')
    expect(wrapper.get('[data-testid="trusted-button"]').text()).toContain('Trusted')
    expect(wrapper.get('[data-testid="kernel-name"]').text()).toContain('Python (Pyodide)')

    expect(wrapper.get('[data-testid="menu-file"]').text()).toBe('File')
    expect(wrapper.get('[data-testid="menu-edit"]').text()).toBe('Edit')
    expect(wrapper.get('[data-testid="menu-run"]').text()).toBe('Run')
    expect(wrapper.get('[data-testid="menu-kernel"]').text()).toBe('Kernel')
    expect(wrapper.find('[data-testid="menu-view"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-settings"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-help"]').exists()).toBe(false)
  })

  it('emits toolbar actions and cell type changes', async () => {
    const wrapper = mount(EditorBar, {
      props: {
        activeCellType: 'code',
        status: 'ready',
      },
    })

    await wrapper.get('[data-testid="toolbar-save"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-add-below"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-add-above"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-cut"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-copy"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-paste"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-run"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-run-advance"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-run-all"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-restart"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-interrupt"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-move-up"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-move-down"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-delete"]').trigger('click')
    await wrapper.get('[data-testid="cell-type-select"]').setValue('markdown')

    expect(wrapper.emitted('save')?.length).toBe(1)
    expect(wrapper.emitted('addCell')?.[0]).toEqual(['code'])
    expect(wrapper.emitted('addCellAbove')?.[0]).toEqual(['code'])
    expect(wrapper.emitted('cutActive')?.length).toBe(1)
    expect(wrapper.emitted('copyActive')?.length).toBe(1)
    expect(wrapper.emitted('pasteBelow')?.length).toBe(1)
    expect(wrapper.emitted('runActive')?.length).toBe(1)
    expect(wrapper.emitted('runAndAdvance')?.length).toBe(1)
    expect(wrapper.emitted('runAll')?.length).toBe(1)
    expect(wrapper.emitted('restartKernel')?.length).toBe(1)
    expect(wrapper.emitted('interrupt')?.length).toBe(1)
    expect(wrapper.emitted('moveCellUp')?.length).toBe(1)
    expect(wrapper.emitted('moveCellDown')?.length).toBe(1)
    expect(wrapper.emitted('deleteActive')?.length).toBe(1)
    expect(wrapper.emitted('setCellType')?.[0]).toEqual(['markdown'])
  })

  it('emits file, edit, run, kernel, and trust actions from menus', async () => {
    const wrapper = mount(EditorBar, {
      props: {
        activeCellType: 'code',
        status: 'ready',
      },
    })

    await wrapper.get('[data-testid="trusted-button"]').trigger('click')

    await clickMenuItem(wrapper, 'file', 'file-save')
    await clickMenuItem(wrapper, 'file', 'file-add-code-below')
    await clickMenuItem(wrapper, 'file', 'file-add-markdown-below')
    await clickMenuItem(wrapper, 'file', 'file-add-raw-below')
    await clickMenuItem(wrapper, 'file', 'file-add-code-above')
    await clickMenuItem(wrapper, 'file', 'file-duplicate')
    await clickMenuItem(wrapper, 'file', 'file-delete')

    await clickMenuItem(wrapper, 'edit', 'edit-cut')
    await clickMenuItem(wrapper, 'edit', 'edit-copy')
    await clickMenuItem(wrapper, 'edit', 'edit-paste-below')
    await clickMenuItem(wrapper, 'edit', 'edit-paste-above')
    await clickMenuItem(wrapper, 'edit', 'edit-move-up')
    await clickMenuItem(wrapper, 'edit', 'edit-move-down')
    await clickMenuItem(wrapper, 'edit', 'edit-type-code')
    await clickMenuItem(wrapper, 'edit', 'edit-type-markdown')
    await clickMenuItem(wrapper, 'edit', 'edit-type-raw')

    await clickMenuItem(wrapper, 'run', 'run-active')
    await clickMenuItem(wrapper, 'run', 'run-advance')
    await clickMenuItem(wrapper, 'run', 'run-all')
    await clickMenuItem(wrapper, 'run', 'run-clear')

    await clickMenuItem(wrapper, 'kernel', 'kernel-interrupt')
    await clickMenuItem(wrapper, 'kernel', 'kernel-restart')
    await clickMenuItem(wrapper, 'kernel', 'kernel-restart-run-all')
    await clickMenuItem(wrapper, 'kernel', 'kernel-update-after-execution')
    await clickMenuItem(wrapper, 'kernel', 'kernel-update-always-live')

    expect(wrapper.emitted('toggleTrust')?.length).toBe(1)
    expect(wrapper.emitted('save')?.length).toBe(1)
    expect(wrapper.emitted('addCell')?.map((entry) => entry[0])).toEqual(['code', 'markdown', 'raw'])
    expect(wrapper.emitted('addCellAbove')?.[0]).toEqual(['code'])
    expect(wrapper.emitted('duplicateActive')?.length).toBe(1)
    expect(wrapper.emitted('deleteActive')?.length).toBe(1)
    expect(wrapper.emitted('cutActive')?.length).toBe(1)
    expect(wrapper.emitted('copyActive')?.length).toBe(1)
    expect(wrapper.emitted('pasteBelow')?.length).toBe(1)
    expect(wrapper.emitted('pasteAbove')?.length).toBe(1)
    expect(wrapper.emitted('moveCellUp')?.length).toBe(1)
    expect(wrapper.emitted('moveCellDown')?.length).toBe(1)
    expect(wrapper.emitted('setCellType')?.map((entry) => entry[0])).toEqual(['code', 'markdown', 'raw'])
    expect(wrapper.emitted('runActive')?.length).toBe(1)
    expect(wrapper.emitted('runAndAdvance')?.length).toBe(1)
    expect(wrapper.emitted('runAll')?.length).toBe(1)
    expect(wrapper.emitted('clearOutputs')?.length).toBe(1)
    expect(wrapper.emitted('interrupt')?.length).toBe(1)
    expect(wrapper.emitted('restartKernel')?.length).toBe(1)
    expect(wrapper.emitted('restartRunAll')?.length).toBe(1)
    expect(wrapper.emitted('setKernelUpdateMode')?.map((entry) => entry[0])).toEqual([
      'after-execution',
      'always-live',
    ])
  })

  it('supports inline notebook renaming', async () => {
    const wrapper = mount(EditorBar, {
      props: {
        notebookTitle: 'Untitled.ipynb',
      },
    })

    await wrapper.get('[data-testid="title-button"]').trigger('click')
    const input = wrapper.get('[data-testid="title-input"]')
    await input.setValue('Renamed.ipynb')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('renameNotebook')?.[0]).toEqual(['Renamed.ipynb'])
  })

  it('disables mutating controls in read-only mode', async () => {
    const wrapper = mount(EditorBar, {
      props: {
        readOnly: true,
      },
    })

    expect(wrapper.get('[data-testid="toolbar-add-below"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-add-above"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-cut"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-paste"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-move-up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-move-down"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="toolbar-delete"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="menu-file"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-item-file-rename"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-add-code-below"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-add-markdown-below"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-add-raw-below"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-add-code-above"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-duplicate"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-file-delete"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="menu-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-item-edit-cut"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-paste-below"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-paste-above"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-move-up"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-move-down"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-type-code"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-type-markdown"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="menu-item-edit-type-raw"]').attributes('disabled')).toBeDefined()
  })
})

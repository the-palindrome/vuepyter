import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditorBar from '@/components/EditorBar.vue'

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
    await wrapper.get('[data-testid="toolbar-run"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-run-advance"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-run-all"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-restart"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-interrupt"]').trigger('click')
    await wrapper.get('[data-testid="toolbar-delete"]').trigger('click')
    await wrapper.get('[data-testid="cell-type-select"]').setValue('markdown')

    expect(wrapper.emitted('save')?.length).toBe(1)
    expect(wrapper.emitted('runActive')?.length).toBe(1)
    expect(wrapper.emitted('runAndAdvance')?.length).toBe(1)
    expect(wrapper.emitted('runAll')?.length).toBe(1)
    expect(wrapper.emitted('restartKernel')?.length).toBe(1)
    expect(wrapper.emitted('interrupt')?.length).toBe(1)
    expect(wrapper.emitted('deleteActive')?.length).toBe(1)
    expect(wrapper.emitted('setCellType')?.[0]).toEqual(['markdown'])
  })

  it('emits menu actions for run and kernel menus', async () => {
    const wrapper = mount(EditorBar, {
      props: {
        status: 'ready',
      },
    })

    await wrapper.get('[data-testid="menu-run"]').trigger('click')
    await wrapper.get('[data-testid="menu-item-run-advance"]').trigger('click')

    await wrapper.get('[data-testid="menu-kernel"]').trigger('click')
    await wrapper.get('[data-testid="menu-item-kernel-restart-run-all"]').trigger('click')

    expect(wrapper.emitted('runAndAdvance')?.length).toBe(1)
    expect(wrapper.emitted('restartRunAll')?.length).toBe(1)
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
    expect(wrapper.get('[data-testid="toolbar-delete"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="menu-file"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-item-file-delete"]').attributes('disabled')).toBeDefined()
  })
})

import { expect, test } from '@playwright/test'
import { cell, expectCellOrder, INITIAL_CELL_IDS, readModel, waitForKernelReady } from './helpers'

test.describe('vuepyter e2e', () => {
  test('edits code in CodeMirror and executes it with Shift+Enter', async ({ page }) => {
    await page.goto('/')
    await waitForKernelReady(page)

    const firstCell = cell(page, 0)
    const firstEditor = firstCell.locator('.cm-content')

    await firstEditor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('print("alpha updated")')
    await expect(firstEditor).toContainText('print("alpha updated")')

    await page.keyboard.press('Shift+Enter')
    await expect(page.locator('.vuepyter-output-pre')).toContainText('alpha updated')
    await expect(page.locator('.vuepyter-cell.is-active').nth(0)).toContainText('Markdown cell')

    const markdownCell = cell(page, 1)
    await markdownCell.locator('.vuepyter-markdown-preview').dblclick()

    const markdownEditor = markdownCell.locator('.cm-content')
    await expect(markdownEditor).toBeVisible()
    await markdownEditor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Updated markdown from CodeMirror')
    await page.keyboard.press('Escape')

    await expect(markdownCell.locator('.vuepyter-markdown-preview')).toContainText('Updated markdown from CodeMirror')
    await expect
      .poll(async () => {
        const model = await readModel(page)
        return model.cells.slice(0, 2).map((entry) => entry.source)
      })
      .toEqual([['print("alpha updated")'], ['Updated markdown from CodeMirror']])
  })

  test('supports command-mode shortcuts for inserting, moving, and deleting cells', async ({ page }) => {
    await page.goto('/')
    await waitForKernelReady(page)

    const notebook = page.locator('.vuepyter-notebook')
    await notebook.focus()

    await page.keyboard.press('Control+Shift+ArrowDown')
    await expectCellOrder(page, ['cell-markdown-1', 'cell-code-1', 'cell-code-2'])

    await page.keyboard.press('Control+Shift+ArrowUp')
    await expectCellOrder(page, INITIAL_CELL_IDS)

    await page.keyboard.press('B')
    await expect.poll(async () => (await readModel(page)).cells.length).toBe(4)
    let model = await readModel(page)
    expect(model.cells).toHaveLength(4)
    expect(model.cells[1]?.cell_type).toBe('code')
    expect(model.cells[1]?.source).toEqual([])

    await page.keyboard.press('D')
    await page.keyboard.press('D')
    await expect.poll(async () => (await readModel(page)).cells.length).toBe(3)
    model = await readModel(page)
    expect(model.cells).toHaveLength(3)
    expect(model.cells.map((cell) => cell.id)).toEqual([...INITIAL_CELL_IDS])
  })

  test('runs all cells and handles toolbar and menu actions', async ({ page }) => {
    await page.goto('/')
    await waitForKernelReady(page)

    await page.getByTestId('toolbar-run-all').click()
    await expect(page.locator('.vuepyter-output-wrap')).toHaveCount(2)
    await expect(page.locator('.vuepyter-output-pre').first()).toContainText('alpha')
    await expect(page.locator('.vuepyter-output-pre').nth(1)).toContainText('42')

    await page.getByTestId('menu-run').click()
    await page.getByTestId('menu-item-run-clear').click()
    await expect(page.locator('.vuepyter-output-wrap')).toHaveCount(0)

    await page.getByTestId('toolbar-interrupt').click()
    await expect(page.getByTestId('last-error')).toContainText('kernel:interrupt')

    await page.getByTestId('menu-kernel').click()
    await page.getByTestId('menu-item-kernel-update-always-live').click()
    await expect(page.getByTestId('kernel-mode')).toHaveText('always-live')
  })
})

import { expect, type Locator, type Page } from '@playwright/test'
import type { SerializedNotebookDocument } from '../../src/index'

export const INITIAL_CELL_IDS = ['cell-code-1', 'cell-markdown-1', 'cell-code-2'] as const

export async function waitForKernelReady(page: Page): Promise<void> {
  await expect(page.getByTestId('kernel-status')).toHaveText('ready')
}

export async function readModel(page: Page): Promise<SerializedNotebookDocument> {
  const json = await page.getByTestId('model-json').textContent()
  if (!json) {
    throw new Error('model-json panel was empty')
  }
  return JSON.parse(json) as SerializedNotebookDocument
}

export function cell(page: Page, index: number): Locator {
  return page.locator('.vuepyter-cell').nth(index)
}

export async function expectCellOrder(page: Page, expected: readonly string[]): Promise<void> {
  await expect
    .poll(async () => (await readModel(page)).cells.map((cell) => cell.id))
    .toEqual([...expected])
}

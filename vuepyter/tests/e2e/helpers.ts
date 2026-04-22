import { expect, type Locator, type Page } from '@playwright/test'
import type { SerializedNotebookDocument } from '../../src/index'

export const INITIAL_CELL_IDS = ['cell-code-1', 'cell-markdown-1', 'cell-code-2'] as const
const NAVIGATION_TIMEOUT_MS = process.env.CI ? 90000 : 60000
const APP_READY_TIMEOUT_MS = process.env.CI ? 60000 : 30000

export async function openNotebookPage(page: Page): Promise<void> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto('/', { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS })
      await page.waitForLoadState('domcontentloaded', { timeout: NAVIGATION_TIMEOUT_MS })
      await expect(page.locator('.vuepyter-notebook')).toBeVisible({ timeout: APP_READY_TIMEOUT_MS })
      await expect(page.getByTestId('model-json')).toContainText('"cells"', { timeout: APP_READY_TIMEOUT_MS })
      return
    } catch (error) {
      lastError = error
      if (attempt >= 2) {
        throw error
      }
      await page.waitForTimeout(500)
    }
  }
  throw lastError
}

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

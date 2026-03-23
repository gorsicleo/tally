import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

export function renderWithUser(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'queries'>,
) {
  return {
    user: userEvent.setup(),
    ...render(ui, options),
  }
}

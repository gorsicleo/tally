import { describe, expect, it } from 'vitest'
import {
  getCondensedChangelog,
  getUpdateDisplayInfo,
  getUpdateSeverityDecision,
  MAX_CHANGELOG_ITEMS,
  normalizeUpdateSeverity,
} from './update-prompt-state'

describe('update prompt decision helpers', () => {
  it('allows direct updates for minor releases', () => {
    expect(getUpdateSeverityDecision('minor')).toEqual({
      requiresBackup: false,
      allowsProceedWithoutBackup: true,
      requiresWarningStep: false,
    })
  })

  it('warns but allows proceeding for recommended-backup releases', () => {
    expect(getUpdateSeverityDecision('recommended-backup')).toEqual({
      requiresBackup: false,
      allowsProceedWithoutBackup: true,
      requiresWarningStep: true,
    })
  })

  it('requires a backup for backup-required releases', () => {
    expect(getUpdateSeverityDecision('backup-required')).toEqual({
      requiresBackup: true,
      allowsProceedWithoutBackup: false,
      requiresWarningStep: true,
    })
  })

  it('falls back to recommended-backup for unknown severity values', () => {
    expect(normalizeUpdateSeverity('unexpected')).toBe('recommended-backup')
    expect(getUpdateSeverityDecision('unexpected')).toEqual({
      requiresBackup: false,
      allowsProceedWithoutBackup: true,
      requiresWarningStep: true,
    })
  })

  it('condenses the changelog to the configured maximum and strips blanks', () => {
    expect(
      getCondensedChangelog([
        'Improved updates',
        '  ',
        'Safer cache cleanup',
        'Backup guidance',
        'Ignored extra item',
      ]),
    ).toEqual([
      'Improved updates',
      'Safer cache cleanup',
      'Backup guidance',
    ])
    expect(MAX_CHANGELOG_ITEMS).toBe(3)
  })

  it('handles malformed changelog data safely', () => {
    expect(getCondensedChangelog('not-an-array')).toEqual([])
    expect(getCondensedChangelog([1, null, 'Valid item'])).toEqual(['Valid item'])
  })

  it('keeps the UI usable when version metadata is partially missing', () => {
    expect(
      getUpdateDisplayInfo({
        changelog: ['One'],
      }),
    ).toEqual({
      version: null,
      changelog: ['One'],
      severity: 'recommended-backup',
    })
  })

  it('normalizes version metadata with trimmed values', () => {
    expect(
      getUpdateDisplayInfo({
        version: ' 1.2.3 ',
        changelog: [' One ', 'Two'],
        severity: 'minor',
      }),
    ).toEqual({
      version: '1.2.3',
      changelog: ['One', 'Two'],
      severity: 'minor',
    })
  })
})

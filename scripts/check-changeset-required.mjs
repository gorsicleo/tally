import { execSync } from 'node:child_process'

const baseRef = process.env.BASE_REF

if (!baseRef) {
  console.error('BASE_REF is required for changeset validation.')
  process.exit(1)
}

function getChangedFiles() {
  const raw = execSync(`git diff --name-only origin/${baseRef}...HEAD`, {
    encoding: 'utf8',
  })

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

const changedFiles = getChangedFiles()

const ignoredPathPrefixes = [
  '.changeset/',
  '.github/',
  'docs/',
  'playwright-report/',
  'test-results/',
]
const ignoredFiles = new Set(['README.md'])
const nonFragmentChangesetFiles = new Set(['.changeset/README.md'])

const hasChangeset = changedFiles.some(
  (filePath) =>
    filePath.startsWith('.changeset/') &&
    filePath.endsWith('.md') &&
    !nonFragmentChangesetFiles.has(filePath),
)

const hasRelevantChanges = changedFiles.some((filePath) => {
  if (ignoredFiles.has(filePath)) {
    return false
  }

  return !ignoredPathPrefixes.some((prefix) => filePath.startsWith(prefix))
})

if (hasRelevantChanges && !hasChangeset) {
  console.error('This PR changes app code but has no changeset entry.')
  console.error('Add one with: npm run changeset')
  console.error('Include a severity marker in the summary:')
  console.error('  [severity:minor]')
  console.error('  [severity:recommended-backup]')
  console.error('  [severity:backup-required]')
  process.exit(1)
}

console.log('Changeset check passed.')

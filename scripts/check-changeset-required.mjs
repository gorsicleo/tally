import { execFileSync } from 'node:child_process'

const baseRef = process.env.BASE_REF

if (!baseRef) {
  console.error('BASE_REF is required for changeset validation.')
  process.exit(1)
}

function getChangedFiles() {
  const raw = execFileSync('git', ['diff', '--name-only', `origin/${baseRef}...HEAD`], {
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
const relevantRootFiles = new Set(['index.html'])
const relevantPathPrefixes = ['src/', 'public/']

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

  if (ignoredPathPrefixes.some((prefix) => filePath.startsWith(prefix))) {
    return false
  }

  if (relevantRootFiles.has(filePath)) {
    return true
  }

  return relevantPathPrefixes.some((prefix) => filePath.startsWith(prefix))
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

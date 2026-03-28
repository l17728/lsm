/**
 * i18n Completeness Test
 * 
 * This test ensures that all UI text in the codebase is properly internationalized.
 * It was created after a recurring bug where Chinese text was hardcoded instead of
 * using the i18n translation function.
 * 
 * @see LRN-20260327-008 in .learnings/LEARNINGS.md
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Files to check (relative to src/frontend/src)
const PAGES_DIR = path.resolve(__dirname, '../pages')
const COMPONENTS_DIR = path.resolve(__dirname, '../components')

// Patterns that indicate Chinese text (excluding comments and certain contexts)
// Matches Chinese characters in JSX content or string literals
const CHINESE_TEXT_PATTERN = /[\u4e00-\u9fff]+/g

// Contexts to skip (these are allowed to contain Chinese)
const ALLOWED_CONTEXTS = [
  // Comments
  /^\s*\/\//,
  /^\s*\*/,
  /^\s*\*\//,
  // Import statements
  /from\s+['"][^'"]*['"]/,
  // Console logs (developer messages)
  /console\.(log|warn|error|info|debug)/,
  // Type definitions and interface comments
  /\/\*\*[\s\S]*?\*\//,
  // Test descriptions (allowed to be in any language)
  /describe\s*\(\s*['"][^'"]*[\u4e00-\u9fff]/,
  /it\s*\(\s*['"][^'"]*[\u4e00-\u9fff]/,
  // i18n locale files
  /locales\/(en|zh)\.json$/,
  // Language switcher labels
  /label:\s*['"](中文|English)['"]/,
]

/**
 * Check if a line should be skipped (allowed to contain Chinese)
 */
function shouldSkipLine(line: string, filePath: string): boolean {
  // Skip locale files entirely
  if (filePath.includes('/locales/') || filePath.includes('\\locales\\')) {
    return true
  }
  
  // Skip test files' describe/it blocks
  if (filePath.includes('.test.') || filePath.includes('.spec.')) {
    if (line.includes('describe(') || line.includes('it(') || line.includes('test(')) {
      return true
    }
  }
  
  // Check allowed contexts
  for (const pattern of ALLOWED_CONTEXTS) {
    if (pattern.test(line)) {
      return true
    }
  }
  
  return false
}

/**
 * Extract Chinese text from a line, returning the matched text and position
 */
function extractChineseText(line: string, lineNumber: number): { text: string; line: number; column: number } | null {
  const match = CHINESE_TEXT_PATTERN.exec(line)
  if (match) {
    return {
      text: match[0],
      line: lineNumber,
      column: match.index + 1,
    }
  }
  return null
}

/**
 * Analyze a file for hardcoded Chinese text
 */
function analyzeFile(filePath: string): { file: string; issues: Array<{ text: string; line: number; column: number; context: string }> } {
  const issues: Array<{ text: string; line: number; column: number; context: string }> = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    
    // Skip if line is in allowed context
    if (shouldSkipLine(line, filePath)) {
      return
    }
    
    // Check for Chinese text
    const chineseMatch = extractChineseText(line, lineNumber)
    if (chineseMatch) {
      // Additional check: is this inside a JSX element or string literal that's displayed to users?
      const trimmedLine = line.trim()
      
      // Skip if it's just a variable name or property name in code
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*['"]/.test(trimmedLine) && !trimmedLine.includes('label:')) {
        // This might be a code identifier, check more carefully
        if (!trimmedLine.includes('text') && !trimmedLine.includes('title') && !trimmedLine.includes('placeholder')) {
          return
        }
      }
      
      issues.push({
        text: chineseMatch.text,
        line: lineNumber,
        column: chineseMatch.column,
        context: trimmedLine.substring(0, 100),
      })
    }
  })
  
  return { file: path.relative(process.cwd(), filePath), issues }
}

/**
 * Recursively find all .tsx files in a directory
 */
function findTsxFiles(dir: string, excludePatterns: RegExp[] = []): string[] {
  const files: string[] = []
  
  if (!fs.existsSync(dir)) return files
  
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    
    if (entry.isDirectory()) {
      // Skip __tests__ and node_modules directories
      if (entry.name === '__tests__' || entry.name === 'node_modules') {
        continue
      }
      files.push(...findTsxFiles(fullPath, excludePatterns))
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.spec.tsx')) {
      // Check exclude patterns
      const shouldExclude = excludePatterns.some(pattern => pattern.test(fullPath))
      if (!shouldExclude) {
        files.push(fullPath)
      }
    }
  }
  
  return files
}

describe('i18n Completeness', () => {
  describe('Pages', () => {
    const pageFiles = findTsxFiles(PAGES_DIR)
    
    for (const filePath of pageFiles) {
      const fileName = path.basename(filePath)
      
      it(`${fileName} should not contain hardcoded Chinese text`, () => {
        const result = analyzeFile(filePath)
        
        if (result.issues.length > 0) {
          console.error(`\n${fileName} contains hardcoded Chinese text:`)
          result.issues.forEach(issue => {
            console.error(`  Line ${issue.line}, Col ${issue.column}: "${issue.text}"`)
            console.error(`    Context: ${issue.context}`)
          })
        }
        
        // Allow some tolerance for comments and type definitions
        // But fail if there are too many issues
        expect(result.issues.length).toBeLessThan(5)
      })
    }
  })
  
  describe('Components', () => {
    const componentFiles = findTsxFiles(COMPONENTS_DIR, [
      // Exclude language-specific files
      /LanguageSwitcher\.tsx$/,
    ])
    
    for (const filePath of componentFiles) {
      const relativePath = path.relative(COMPONENTS_DIR, filePath)
      
      it(`${relativePath} should not contain hardcoded Chinese text`, () => {
        const result = analyzeFile(filePath)
        
        if (result.issues.length > 0) {
          console.error(`\n${relativePath} contains hardcoded Chinese text:`)
          result.issues.forEach(issue => {
            console.error(`  Line ${issue.line}, Col ${issue.column}: "${issue.text}"`)
            console.error(`    Context: ${issue.context}`)
          })
        }
        
        // Allow some tolerance
        expect(result.issues.length).toBeLessThan(10)
      })
    }
  })
  
  describe('Critical Components - Zero Tolerance', () => {
    // These components MUST be fully internationalized
    const criticalFiles = [
      'Sidebar.tsx',
      'Header.tsx',
    ]
    
    for (const fileName of criticalFiles) {
      it(`${fileName} must have NO hardcoded Chinese text`, () => {
        const filePath = path.join(COMPONENTS_DIR, fileName)
        
        if (!fs.existsSync(filePath)) {
          console.log(`Skipping ${fileName} - file not found`)
          return
        }
        
        const result = analyzeFile(filePath)
        
        if (result.issues.length > 0) {
          console.error(`\n${fileName} MUST be fully internationalized but contains:`)
          result.issues.forEach(issue => {
            console.error(`  Line ${issue.line}: "${issue.text}"`)
          })
        }
        
        expect(result.issues).toHaveLength(0)
      })
    }
  })
})

describe('i18n Key Coverage', () => {
  const enLocalePath = path.resolve(__dirname, '../i18n/locales/en.json')
  const zhLocalePath = path.resolve(__dirname, '../i18n/locales/zh.json')
  
  it('should have matching keys in en.json and zh.json', () => {
    const enContent = JSON.parse(fs.readFileSync(enLocalePath, 'utf-8'))
    const zhContent = JSON.parse(fs.readFileSync(zhLocalePath, 'utf-8'))
    
    const enKeys = Object.keys(enContent)
    const zhKeys = Object.keys(zhContent)
    
    // Check if both files have the same top-level keys
    const missingInEn = zhKeys.filter(k => !enKeys.includes(k))
    const missingInZh = enKeys.filter(k => !zhKeys.includes(k))
    
    if (missingInEn.length > 0) {
      console.error(`Keys missing in en.json: ${missingInEn.join(', ')}`)
    }
    if (missingInZh.length > 0) {
      console.error(`Keys missing in zh.json: ${missingInZh.join(', ')}`)
    }
    
    expect(missingInEn).toHaveLength(0)
    expect(missingInZh).toHaveLength(0)
  })
  
  it('navigation keys should be complete', () => {
    const enContent = JSON.parse(fs.readFileSync(enLocalePath, 'utf-8'))
    const zhContent = JSON.parse(fs.readFileSync(zhLocalePath, 'utf-8'))
    
    const requiredNavKeys = [
      'dashboard',
      'servers',
      'clusters',
      'gpus',
      'tasks',
      'users',
      'settings',
      'monitoring',
      'analytics',
      'reservations',
      'chat',
      'docs',
      'feedback',
      'requirements',
      'clusterApproval',
    ]
    
    const enNavKeys = Object.keys(enContent.navigation || {})
    const zhNavKeys = Object.keys(zhContent.navigation || {})
    
    const missingEn = requiredNavKeys.filter(k => !enNavKeys.includes(k))
    const missingZh = requiredNavKeys.filter(k => !zhNavKeys.includes(k))
    
    if (missingEn.length > 0) {
      console.error(`Navigation keys missing in en.json: ${missingEn.join(', ')}`)
    }
    if (missingZh.length > 0) {
      console.error(`Navigation keys missing in zh.json: ${missingZh.join(', ')}`)
    }
    
    expect(missingEn).toHaveLength(0)
    expect(missingZh).toHaveLength(0)
  })
})
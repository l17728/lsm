/**
 * Import Completeness Test
 * 
 * This test ensures that all API imports are complete across the codebase.
 * It was created after a recurring bug where `authApi` was used in Clusters.tsx
 * but not imported, causing runtime errors.
 * 
 * @see LRN-20260327-001 in .learnings/LEARNINGS.md
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Define all known APIs that should be imported from '../services/api'
const KNOWN_APIS = [
  'authApi',
  'serverApi', 
  'gpuApi',
  'taskApi',
  'monitoringApi',
  'analyticsApi',
  'clusterApi',
  'clusterReservationApi',
]

// Pages to check (relative to src/frontend/src/pages)
const PAGE_FILES = [
  'Clusters.tsx',
  'ClusterApproval.tsx',
  'Dashboard.tsx',
  'Analytics.tsx',
  'Monitoring.tsx',
  'Servers.tsx',
  'GPUs.tsx',
  'Tasks.tsx',
  'Users.tsx',
  'Login.tsx',
  'Reservations.tsx',
  'MyReservations.tsx',
  'ReservationForm.tsx',
  'ChatPage.tsx',
  'Settings.tsx',
]

// Components to check
const COMPONENT_DIRS = [
  'components',
]

/**
 * Extract API usage patterns from file content
 */
function extractApiUsage(content: string): Set<string> {
  const usedApis = new Set<string>()
  
  for (const api of KNOWN_APIS) {
    // Match patterns like: authApi.getUsers(), clusterApi.getAll(), etc.
    // But NOT in comments or strings that are just documentation
    const apiUsagePattern = new RegExp(`\\b${api}\\s*\\.`, 'g')
    const matches = content.match(apiUsagePattern)
    if (matches) {
      usedApis.add(api)
    }
  }
  
  return usedApis
}

/**
 * Extract imported APIs from file content
 */
function extractApiImports(content: string, filePath: string): Set<string> {
  const importedApis = new Set<string>()
  
  // Match import statements like:
  // import { authApi, serverApi } from '../services/api'
  // import { authApi } from '../../services/api'
  // import { authApi, clusterApi, clusterReservationApi } from '../services/api'
  
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.\.?\/)*services\/api['"]/g
  let match
  
  while ((match = importPattern.exec(content)) !== null) {
    const imports = match[1]
    for (const api of KNOWN_APIS) {
      if (imports.includes(api)) {
        importedApis.add(api)
      }
    }
  }
  
  // Also check for API imports from reservation.service
  const reservationImportPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.\.?\/)*services\/reservation\.service['"]/g
  while ((match = reservationImportPattern.exec(content)) !== null) {
    const imports = match[1]
    // reservationApi is exported from reservation.service
    if (imports.includes('reservationApi')) {
      importedApis.add('reservationApi')
    }
  }
  
  return importedApis
}

describe('Import Completeness', () => {
  const pagesDir = path.resolve(__dirname, '../pages')
  
  describe('Pages', () => {
    for (const fileName of PAGE_FILES) {
      it(`${fileName} should import all used APIs`, () => {
        const filePath = path.join(pagesDir, fileName)
        
        // Skip if file doesn't exist
        if (!fs.existsSync(filePath)) {
          console.log(`Skipping ${fileName} - file not found`)
          return
        }
        
        const content = fs.readFileSync(filePath, 'utf-8')
        const usedApis = extractApiUsage(content)
        const importedApis = extractApiImports(content, filePath)
        
        // Find missing imports
        const missingImports = [...usedApis].filter(api => !importedApis.has(api))
        
        if (missingImports.length > 0) {
          console.error(`\n${fileName} uses but does not import: ${missingImports.join(', ')}`)
          console.error(`Used APIs: ${[...usedApis].join(', ')}`)
          console.error(`Imported APIs: ${[...importedApis].join(', ')}`)
        }
        
        expect(missingImports).toHaveLength(0)
      })
    }
  })
  
  describe('Components', () => {
    const componentsDir = path.resolve(__dirname, '../components')
    
    // Recursively find all .tsx files in components
    function findTsxFiles(dir: string): string[] {
      const files: string[] = []
      
      if (!fs.existsSync(dir)) return files
      
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // Skip __tests__ directories
          if (entry.name !== '__tests__') {
            files.push(...findTsxFiles(fullPath))
          }
        } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
          files.push(fullPath)
        }
      }
      
      return files
    }
    
    const componentFiles = findTsxFiles(componentsDir)
    
    for (const filePath of componentFiles) {
      const relativePath = path.relative(componentsDir, filePath)
      
      it(`${relativePath} should import all used APIs`, () => {
        const content = fs.readFileSync(filePath, 'utf-8')
        const usedApis = extractApiUsage(content)
        const importedApis = extractApiImports(content, filePath)
        
        const missingImports = [...usedApis].filter(api => !importedApis.has(api))
        
        if (missingImports.length > 0) {
          console.error(`\n${relativePath} uses but does not import: ${missingImports.join(', ')}`)
        }
        
        expect(missingImports).toHaveLength(0)
      })
    }
  })
})
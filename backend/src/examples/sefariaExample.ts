/**
 * Example usage of the SefariaService
 * This file demonstrates how to use the Sefaria API integration service
 */

import { sefariaService } from '../services/sefariaService'

async function demonstrateSefariaService() {
    try {
        console.log('=== Sefaria Service Demo ===\n')

        // 1. Get the index of available texts
        console.log('1. Fetching Sefaria index...')
        const index = await sefariaService.getIndex()
        console.log(`Found ${index.length} texts in the Sefaria library`)
        console.log('First few texts:', index.slice(0, 3).map(t => t.title))
        console.log()

        // 2. Get text structure for Genesis
        console.log('2. Getting text structure for Genesis...')
        const structure = await sefariaService.getTextStructure('Genesis')
        console.log(`Genesis has ${structure.depth} levels: ${structure.sectionNames.join(', ')}`)
        console.log()

        // 3. Get specific text content
        console.log('3. Fetching Genesis 1:1...')
        const text = await sefariaService.getText('Genesis 1:1')
        console.log('English:', text.text[0])
        console.log('Hebrew:', text.he[0])
        console.log()

        // 4. Search for texts
        console.log('4. Searching for "beginning"...')
        const searchResults = await sefariaService.searchTexts('beginning', 3)
        console.log(`Found ${searchResults.length} results:`)
        searchResults.forEach((result, i) => {
            console.log(`  ${i + 1}. ${result.ref}: ${result.content.substring(0, 100)}...`)
        })
        console.log()

        // 5. Get links for a text
        console.log('5. Getting links for Genesis 1:1...')
        const links = await sefariaService.getLinks('Genesis 1:1')
        console.log(`Found ${links.length} linked texts`)
        if (links.length > 0) {
            console.log('First link:', links[0].sourceRef)
        }
        console.log()

        // 6. Show cache statistics
        console.log('6. Cache statistics:')
        const stats = sefariaService.getCacheStats()
        console.log(`Cache size: ${stats.size} entries`)
        console.log('Cached keys:', stats.keys)

    } catch (error) {
        console.error('Error demonstrating Sefaria service:', error)
    }
}

// Export for potential use in other files
export { demonstrateSefariaService }

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateSefariaService()
}
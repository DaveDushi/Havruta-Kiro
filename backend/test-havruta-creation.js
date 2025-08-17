// Simple test script to verify Havruta creation functionality
import axios from 'axios'

const API_BASE = 'http://localhost:3001/api'

async function testSefariaIndex() {
  try {
    console.log('Testing Sefaria index endpoint...')
    const response = await axios.get(`${API_BASE}/sefaria/index`)
    
    console.log(`✅ Successfully fetched ${response.data.length} top-level categories from Sefaria`)
    
    // Show the hierarchical structure
    console.log('\nTop-level categories:')
    response.data.forEach((category, index) => {
      console.log(`${index + 1}. ${category.category || category.title} (${category.heCategory || category.heTitle || 'No Hebrew'})`)
      if (category.contents && category.contents.length > 0) {
        console.log(`   - Has ${category.contents.length} subcategories/books`)
        // Show first few subcategories
        category.contents.slice(0, 3).forEach((sub, subIndex) => {
          console.log(`     ${subIndex + 1}. ${sub.category || sub.title} ${sub.contents ? `(${sub.contents.length} items)` : '📖'}`)
        })
        if (category.contents.length > 3) {
          console.log(`     ... and ${category.contents.length - 3} more`)
        }
      }
    })
    
    return response.data
  } catch (error) {
    console.error('❌ Error fetching Sefaria index:', error.message)
    return null
  }
}

async function testHavrutaCreation() {
  try {
    console.log('\nTesting Havruta creation...')
    
    // First get some books
    const books = await testSefariaIndex()
    if (!books || books.length === 0) {
      console.error('❌ Cannot test Havruta creation without books')
      return
    }
    
    // Flatten the structure like the frontend does
    const flattenBooks = (items) => {
      const books = []
      
      for (const item of items) {
        if (item.title && item.categories && !item.contents) {
          books.push({
            title: item.title,
            heTitle: item.heTitle || item.title,
            categories: item.categories || [],
            primary_category: item.primary_category || item.categories?.[0] || 'Other'
          })
        } else if (item.contents) {
          books.push(...flattenBooks(item.contents))
        }
      }
      
      return books
    }
    
    const allBooks = flattenBooks(books)
    const torahBooks = allBooks.filter(book => 
      book.categories.includes('Tanakh') || 
      book.categories.includes('Torah')
    )
    
    console.log(`Found ${allBooks.length} total books, ${torahBooks.length} Torah books`)
    
    const torahBook = torahBooks[0] || allBooks[0]
    
    const havrutaData = {
      name: `${torahBook.title} Study Group`,
      bookId: torahBook.title,
      bookTitle: torahBook.title,
      currentSection: `${torahBook.title} 1:1`
    }
    
    console.log('Creating Havruta with data:', havrutaData)
    
    // Note: This would require authentication in a real scenario
    // For now, just log what would be sent
    console.log('✅ Havruta data prepared successfully')
    console.log('📝 In a real scenario, this would be sent to POST /api/havrutot')
    
  } catch (error) {
    console.error('❌ Error in Havruta creation test:', error.message)
  }
}

// Run the tests
async function runTests() {
  console.log('🧪 Testing Havruta Creation Functionality\n')
  await testHavrutaCreation()
  console.log('\n✨ Tests completed!')
}

runTests().catch(console.error)
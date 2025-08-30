import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextViewer } from '../components/TextViewer'
import { sefariaService } from '../services/sefariaService'
import { SefariaText } from '../types'

// Mock the Sefaria service
vi.mock('../services/sefariaService', () => ({
  sefariaService: {
    getText: vi.fn(),
    parseRef: vi.fn(),
    buildRef: vi.fn(),
    clearCache: vi.fn()
  }
}))

const mockSefariaText: SefariaText = {
  ref: 'Genesis 1',
  heRef: 'בראשית א',
  text: [
    'In the beginning God created the heaven and the earth.',
    'And the earth was without form, and void; and darkness was upon the face of the deep.',
    'And the Spirit of God moved upon the face of the waters.'
  ],
  he: [
    'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ',
    'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם',
    'וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם'
  ],
  versions: [
    {
      title: 'Genesis',
      versionTitle: 'The Contemporary Torah, Jewish Publication Society, 2006',
      versionSource: 'https://www.sefaria.org',
      language: 'en',
      status: 'locked',
      priority: 1
    }
  ],
  textDepth: 2,
  sectionNames: ['Chapter', 'Verse'],
  addressTypes: ['Integer', 'Integer'],
  next: 'Genesis 2',
  prev: null,
  book: 'Genesis',
  title: 'Genesis',
  heTitle: 'בראשית',
  categories: ['Tanakh', 'Torah'],
  primary_category: 'Tanakh',
  sections: [1],
  toSections: [1],
  sectionRef: 'Genesis 1',
  heSectionRef: 'בראשית א',
  firstAvailableSectionRef: 'Genesis 1:1',
  isSpanning: false,
  spanningRefs: []
}

describe('TextViewer', () => {
  const user = userEvent.setup()
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    vi.mocked(sefariaService.getText).mockResolvedValue(mockSefariaText)
    vi.mocked(sefariaService.parseRef).mockImplementation((ref: string) => {
      const parts = ref.split(' ')
      const book = parts[0]
      if (parts.length > 1) {
        const [chapter, verse] = parts[1].split(':').map(Number)
        return { book, chapter, verse }
      }
      return { book }
    })
    vi.mocked(sefariaService.buildRef).mockImplementation((book: string, chapter?: number, verse?: number) => {
      if (chapter && verse) {
        return `${book} ${chapter}:${verse}`
      } else if (chapter) {
        return `${book} ${chapter}`
      }
      return book
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with book title', async () => {
      render(<TextViewer bookTitle="Genesis" />)
      
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    it('shows loading state initially', () => {
      render(<TextViewer bookTitle="Genesis" />)
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('loads and displays text content', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText('Genesis 1')).toBeInTheDocument()
      })
      
      expect(screen.getByText('In the beginning God created the heaven and the earth.')).toBeInTheDocument()
      expect(screen.getByText('בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ')).toBeInTheDocument()
    })

    it('displays Hebrew text with RTL direction', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        const hebrewSection = screen.getByText('Hebrew')
        expect(hebrewSection).toBeInTheDocument()
      })
      
      const hebrewText = screen.getByText('בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ')
      expect(hebrewText.closest('div')).toHaveStyle({ direction: 'rtl' })
    })
  })

  describe('Navigation', () => {
    it('calls onNavigationChange when navigation occurs', async () => {
      const onNavigationChange = vi.fn()
      
      render(
        <TextViewer 
          bookTitle="Genesis" 
          initialRef="Genesis 1"
          onNavigationChange={onNavigationChange}
        />
      )
      
      await waitFor(() => {
        expect(onNavigationChange).toHaveBeenCalledWith('Genesis 1')
      })
    })

    it('calls onSectionChange when section loads', async () => {
      const onSectionChange = vi.fn()
      
      render(
        <TextViewer 
          bookTitle="Genesis" 
          initialRef="Genesis 1"
          onSectionChange={onSectionChange}
        />
      )
      
      await waitFor(() => {
        expect(onSectionChange).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'Genesis 1',
            heRef: 'בראשית א'
          })
        )
      })
    })

    it('enables navigation controls when not read-only', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Previous section')).toBeInTheDocument()
        expect(screen.getByLabelText('Next section')).toBeInTheDocument()
        expect(screen.getByLabelText('Jump to section')).toBeInTheDocument()
      })
    })

    it('hides navigation controls in read-only mode', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" isReadOnly />)
      
      await waitFor(() => {
        expect(screen.queryByLabelText('Previous section')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Next section')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Jump to section')).not.toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('renders search bar when not read-only', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search in text...')).toBeInTheDocument()
      })
    })

    it('hides search bar in read-only mode', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" isReadOnly />)
      
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search in text...')).not.toBeInTheDocument()
      })
    })

    it('performs search and highlights results', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText('In the beginning God created the heaven and the earth.')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search in text...')
      await user.type(searchInput, 'God')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        // Should find highlighted text
        const highlightedElements = screen.getAllByText('God')
        expect(highlightedElements.length).toBeGreaterThan(0)
      })
    })

    it('handles external search query', async () => {
      const { rerender } = render(
        <TextViewer bookTitle="Genesis" initialRef="Genesis 1" />
      )
      
      await waitFor(() => {
        expect(screen.getByText('In the beginning God created the heaven and the earth.')).toBeInTheDocument()
      })
      
      // Update with external search query
      rerender(
        <TextViewer 
          bookTitle="Genesis" 
          initialRef="Genesis 1" 
          searchQuery="earth"
        />
      )
      
      await waitFor(() => {
        const highlightedElements = screen.getAllByText('earth')
        expect(highlightedElements.length).toBeGreaterThan(0)
      })
    })

    it('clears search results when search is cleared', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText('In the beginning God created the heaven and the earth.')).toBeInTheDocument()
      })
      
      const searchInput = screen.getByPlaceholderText('Search in text...')
      await user.type(searchInput, 'God')
      await user.keyboard('{Enter}')
      
      // Clear search
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(searchInput).toHaveValue('')
    })
  })

  describe('Error Handling', () => {
    it('displays error message when text loading fails', async () => {
      vi.mocked(sefariaService.getText).mockRejectedValue(new Error('API Error'))
      
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch data from Sefaria API/)).toBeInTheDocument()
      })
    })

    it('handles missing text gracefully', async () => {
      vi.mocked(sefariaService.getText).mockResolvedValue({
        ...mockSefariaText,
        text: [],
        he: []
      })
      
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText('Genesis 1')).toBeInTheDocument()
      })
      
      // Should not crash and should show the reference
      expect(screen.getByText('Genesis 1')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('adapts layout for mobile', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      })
      
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByText(/In the beginning God created/)).toBeInTheDocument()
      })
      
      // The component should render without errors on mobile
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })
  })

  describe('Highlights', () => {
    it('displays external highlights', async () => {
      const highlights = [
        {
          text: 'God',
          startIndex: 17,
          endIndex: 20,
          ref: 'Genesis 1:1'
        }
      ]
      
      render(
        <TextViewer 
          bookTitle="Genesis" 
          initialRef="Genesis 1"
          highlights={highlights}
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText('In the beginning God created the heaven and the earth.')).toBeInTheDocument()
      })
      
      // Should display highlighted text
      const highlightedElements = screen.getAllByText('God')
      expect(highlightedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Jump to Section', () => {
    it('allows jumping to specific section', async () => {
      render(<TextViewer bookTitle="Genesis" initialRef="Genesis 1" />)
      
      await waitFor(() => {
        expect(screen.getByLabelText('Jump to section')).toBeInTheDocument()
      })
      
      // Click jump to section button
      const jumpButton = screen.getByLabelText('Jump to section')
      await user.click(jumpButton)
      
      // Should show input field
      const jumpInput = screen.getByPlaceholderText('e.g., Genesis 2:5')
      expect(jumpInput).toBeInTheDocument()
      
      // Type new reference
      await user.type(jumpInput, 'Genesis 2')
      
      // Click Go button
      const goButton = screen.getByText('Go')
      await user.click(goButton)
      
      // Should call getText with new reference
      expect(sefariaService.getText).toHaveBeenCalledWith('Genesis 2')
    })
  })
})
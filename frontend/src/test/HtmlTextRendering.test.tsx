import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TextContent from '../components/TextViewer/TextContent'
import { SefariaText, TextSection } from '../types'

const mockSefariaTextWithHtml: SefariaText = {
  ref: 'Genesis 5:1',
  heRef: 'בראשית ה׳:א׳',
  text: [
    'This is the record of Adam\'s line.—When God created humankind, it was made in the likeness of God; <sup class="footnote-marker">*</sup><i>Humankind</i> <b>Heb.</b> <i>adam</i>; NJPS "Man," trad. "Adam."</i>'
  ],
  he: [
    'זה ספר תולדת אדם ביום ברא אלהים אדם בדמות אלהים עשה אתו: <sup class="footnote-marker">*</sup><i>בספר תולדת אדם</i> <big>ו</big><big>זכר ונקבה בראם</big>'
  ],
  versions: [
    {
      versionTitle: 'Test Version',
      status: 'locked',
      priority: 1
    }
  ],
  textDepth: 2,
  sectionNames: ['Chapter', 'Verse'],
  addressTypes: ['Integer', 'Integer'],
  next: 'Genesis 5:2',
  prev: 'Genesis 4:26',
  book: 'Genesis',
  title: 'Genesis',
  heTitle: 'בראשית',
  categories: ['Tanakh', 'Torah'],
  primary_category: 'Tanakh',
  sections: [5],
  toSections: [5],
  sectionRef: 'Genesis 5',
  heSectionRef: 'בראשית ה׳',
  firstAvailableSectionRef: 'Genesis 5:1',
  isSpanning: false,
  spanningRefs: []
}

const mockSection: TextSection = {
  ref: 'Genesis 5:1',
  heRef: 'בראשית ה׳:א׳',
  text: mockSefariaTextWithHtml.text,
  he: mockSefariaTextWithHtml.he,
  sectionIndex: 0,
  chapterIndex: 5,
  verseIndex: 1
}

describe('HTML Text Rendering', () => {
  it('renders HTML content with proper formatting', () => {
    render(
      <TextContent
        text={mockSefariaTextWithHtml}
        section={mockSection}
      />
    )
    
    // Check that the text content is rendered
    expect(screen.getByText(/This is the record of Adam's line/)).toBeInTheDocument()
    
    // Check that HTML elements are preserved
    const supElements = document.querySelectorAll('sup')
    expect(supElements.length).toBeGreaterThan(0)
    
    const italicElements = document.querySelectorAll('i')
    expect(italicElements.length).toBeGreaterThan(0)
    
    const boldElements = document.querySelectorAll('b')
    expect(boldElements.length).toBeGreaterThan(0)
  })

  it('renders Hebrew text with HTML formatting', () => {
    render(
      <TextContent
        text={mockSefariaTextWithHtml}
        section={mockSection}
      />
    )
    
    // Check that Hebrew text is rendered
    expect(screen.getByText(/זה ספר תולדת אדם/)).toBeInTheDocument()
    
    // Check that big elements are preserved in Hebrew text
    const bigElements = document.querySelectorAll('big')
    expect(bigElements.length).toBeGreaterThan(0)
  })

  it('sanitizes potentially dangerous HTML', () => {
    const dangerousText: SefariaText = {
      ...mockSefariaTextWithHtml,
      text: [
        'Safe text <script>alert("xss")</script> with <sup>footnote</sup>'
      ]
    }
    
    render(
      <TextContent
        text={dangerousText}
        section={mockSection}
      />
    )
    
    // Script tags should be removed
    expect(document.querySelector('script')).toBeNull()
    
    // Safe HTML should remain
    expect(document.querySelector('sup')).toBeInTheDocument()
  })
})
import React from 'react'
import { Box, Typography, Paper } from '@mui/material'
import TextContent from '../components/TextViewer/TextContent'
import { SefariaText, TextSection } from '../types'

// Example Sefaria text with HTML formatting
const exampleSefariaText: SefariaText = {
  ref: 'Genesis 5:1',
  heRef: 'בראשית ה׳:א׳',
  text: [
    'This is the record of Adam\'s line.—When God created humankind, it was made in the likeness of God; <sup class="footnote-marker">*</sup><i>Humankind</i> <b>Heb.</b> <i>adam</i>; NJPS "Man," trad. "Adam."</i>',
    'When Adam had lived 130 years, he begot a son in his likeness after his image, and he named him Seth.',
    'After the birth of Seth, Adam lived 800 years and begot sons and daughters.'
  ],
  he: [
    'זה ספר תולדת אדם ביום ברא אלהים אדם בדמות אלהים עשה אתו: <sup class="footnote-marker">*</sup><i>בספר תולדת אדם</i> <big>ו</big><big>זכר ונקבה בראם</big>',
    'ויחי אדם שלשים ומאת שנה ויולד בדמותו כצלמו ויקרא את־שמו שת:',
    'ויהיו ימי־אדם אחרי הולידו את־שת שמנה מאות שנה ויולד בנים ובנות:'
  ],
  versions: [
    {
      versionTitle: 'The Contemporary Torah, Jewish Publication Society, 2006',
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

const exampleSection: TextSection = {
  ref: 'Genesis 5:1',
  heRef: 'בראשית ה׳:א׳',
  text: exampleSefariaText.text,
  he: exampleSefariaText.he,
  sectionIndex: 0,
  chapterIndex: 5,
  verseIndex: 1
}

const SefariaHtmlExample: React.FC = () => {
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Sefaria HTML Formatting Example
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        This example demonstrates how Sefaria text with HTML formatting is rendered:
      </Typography>

      <Paper elevation={2} sx={{ p: 2 }}>
        <TextContent
          text={exampleSefariaText}
          section={exampleSection}
        />
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          HTML Features Demonstrated:
        </Typography>
        <ul>
          <li><code>&lt;sup&gt;</code> tags for footnote markers</li>
          <li><code>&lt;i&gt;</code> and <code>&lt;b&gt;</code> tags for emphasis</li>
          <li><code>&lt;big&gt;</code> tags for larger text in Hebrew</li>
          <li>CSS classes like <code>footnote-marker</code> for styling</li>
          <li>Proper RTL direction for Hebrew text</li>
        </ul>
      </Box>
    </Box>
  )
}

export default SefariaHtmlExample
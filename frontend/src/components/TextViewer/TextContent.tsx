import React, { useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  useTheme
} from '@mui/material'
import { SefariaText, TextSection, SearchHighlight } from '../../types'

// Simple HTML sanitizer for Sefaria text
const sanitizeHtml = (html: string): string => {
  // Allow only specific tags that Sefaria uses
  const allowedTags = ['sup', 'sub', 'big', 'small', 'span', 'i', 'b', 'strong', 'em']
  const allowedAttributes = ['class', 'title']
  
  // Basic sanitization - in production, consider using a library like DOMPurify
  let sanitized = html
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  
  return sanitized
}

// Component to render HTML content safely
const HtmlContent: React.FC<{ html: string; className?: string; isHebrew?: boolean }> = ({ 
  html, 
  className = '', 
  isHebrew = false 
}) => {
  const sanitizedHtml = useMemo(() => sanitizeHtml(html), [html])
  
  const cssClasses = `sefaria-text ${isHebrew ? 'sefaria-hebrew' : 'sefaria-english'} ${className}`.trim()
  
  return (
    <span 
      className={cssClasses}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}

interface TextContentProps {
  text: SefariaText
  section: TextSection
  highlights?: SearchHighlight[]
  searchQuery?: string
  loading?: boolean
  isMobile?: boolean
}

interface HighlightedTextProps {
  text: string
  highlights: SearchHighlight[]
  searchQuery?: string
  lineRef: string
  isHebrew?: boolean
}

const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlights,
  searchQuery,
  lineRef,
  isHebrew = false
}) => {
  const theme = useTheme()

  const highlightedText = useMemo(() => {
    // Check if text contains HTML tags
    const hasHtml = /<[^>]+>/.test(text)
    
    if (!highlights.length && !searchQuery) {
      return hasHtml ? <HtmlContent html={text} isHebrew={isHebrew} /> : text
    }

    // For now, if there are highlights and HTML, we'll render HTML without highlighting
    // This is a simplified approach - a full implementation would need to parse HTML and apply highlights
    if (hasHtml) {
      return <HtmlContent html={text} isHebrew={isHebrew} />
    }

    // Find highlights for this specific line
    const lineHighlights = highlights.filter(h => h.ref === lineRef)
    
    // Also search for the current search query if provided
    const allHighlights: Array<{ start: number, end: number, type: 'search' | 'highlight' }> = []
    
    // Add explicit highlights
    lineHighlights.forEach(h => {
      allHighlights.push({
        start: h.startIndex,
        end: h.endIndex,
        type: 'highlight'
      })
    })
    
    // Add search query highlights
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const lowerText = text.toLowerCase()
      let startIndex = 0
      
      while (true) {
        const foundIndex = lowerText.indexOf(query, startIndex)
        if (foundIndex === -1) break
        
        allHighlights.push({
          start: foundIndex,
          end: foundIndex + query.length,
          type: 'search'
        })
        
        startIndex = foundIndex + 1
      }
    }
    
    if (allHighlights.length === 0) {
      return text
    }
    
    // Sort highlights by start position
    allHighlights.sort((a, b) => a.start - b.start)
    
    // Merge overlapping highlights
    const mergedHighlights: Array<{ start: number, end: number, type: 'search' | 'highlight' }> = []
    for (const highlight of allHighlights) {
      const last = mergedHighlights[mergedHighlights.length - 1]
      if (last && highlight.start <= last.end) {
        last.end = Math.max(last.end, highlight.end)
      } else {
        mergedHighlights.push(highlight)
      }
    }
    
    // Build highlighted text
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    
    mergedHighlights.forEach((highlight, index) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        parts.push(text.substring(lastIndex, highlight.start))
      }
      
      // Add highlighted text
      const highlightedPart = text.substring(highlight.start, highlight.end)
      parts.push(
        <span
          key={index}
          style={{
            backgroundColor: highlight.type === 'search' 
              ? theme.palette.warning.light 
              : theme.palette.info.light,
            color: highlight.type === 'search'
              ? theme.palette.warning.contrastText
              : theme.palette.info.contrastText,
            padding: '1px 2px',
            borderRadius: '2px',
            fontWeight: 'bold'
          }}
        >
          {highlightedPart}
        </span>
      )
      
      lastIndex = highlight.end
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts
  }, [text, highlights, searchQuery, lineRef, theme])

  return <>{highlightedText}</>
}

const TextContent: React.FC<TextContentProps> = ({
  text,
  section,
  highlights = [],
  searchQuery,
  loading = false,
  isMobile = false
}) => {
  console.log('TextContent received text:', text)
  console.log('TextContent text.text:', text?.text)
  console.log('TextContent text.he:', text?.he)
  
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="text"
            height={24}
            sx={{ mb: 1 }}
            width={`${Math.random() * 40 + 60}%`}
          />
        ))}
      </Box>
    )
  }

  const hasHebrew = text.he && text.he.length > 0
  const hasEnglish = text.text && text.text.length > 0

  return (
    <Box sx={{ p: 2 }}>
      {/* Text reference header */}
      <Box sx={{ mb: 3, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          {text.ref}
        </Typography>
        {text.heRef && (
          <Typography 
            variant="subtitle1" 
            sx={{ 
              fontFamily: 'serif',
              direction: 'rtl',
              textAlign: 'right',
              color: 'text.secondary'
            }}
          >
            {text.heRef}
          </Typography>
        )}
      </Box>

      {/* Text content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 3
        }}
      >
        {/* Hebrew text */}
        {hasHebrew && (
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: 2,
              bgcolor: 'grey.50',
              border: 1,
              borderColor: 'grey.200'
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}
            >
              Hebrew
            </Typography>
            <Box
              sx={{
                direction: 'rtl',
                textAlign: 'right',
                lineHeight: 1.8,
                fontSize: '1.1rem',
                fontFamily: 'serif'
              }}
            >
              {text.he.map((line, index) => {
                const lineRef = `${text.ref}:${index + 1}`
                return (
                  <Typography
                    key={index}
                    component="div"
                    sx={{
                      mb: 1,
                      minHeight: '1.5em',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        px: 1,
                        mx: -1
                      },
                      // Sefaria-specific HTML styling
                      '& .footnote-marker': {
                        fontSize: '0.75em',
                        verticalAlign: 'super',
                        color: 'text.secondary',
                        fontWeight: 'bold'
                      },
                      '& .footnote': {
                        fontSize: '0.85em',
                        color: 'text.secondary',
                        fontStyle: 'italic'
                      },
                      '& .mam-spi-samekh': {
                        letterSpacing: '0.2em'
                      },
                      '& sup': {
                        fontSize: '0.75em',
                        verticalAlign: 'super',
                        color: 'text.secondary'
                      },
                      '& sub': {
                        fontSize: '0.75em',
                        verticalAlign: 'sub'
                      },
                      '& big': {
                        fontSize: '1.2em'
                      },
                      '& small': {
                        fontSize: '0.85em'
                      }
                    }}
                  >
                    <HighlightedText
                      text={line}
                      highlights={highlights}
                      searchQuery={searchQuery}
                      lineRef={lineRef}
                      isHebrew={true}
                    />
                  </Typography>
                )
              })}
            </Box>
          </Paper>
        )}

        {/* English text */}
        {hasEnglish && (
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              p: 2,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'grey.200'
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}
            >
              English
            </Typography>
            <Box
              sx={{
                lineHeight: 1.7,
                fontSize: '1rem'
              }}
            >
              {text.text.map((line, index) => {
                const lineRef = `${text.ref}:${index + 1}`
                return (
                  <Typography
                    key={index}
                    component="div"
                    sx={{
                      mb: 1,
                      minHeight: '1.5em',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        px: 1,
                        mx: -1
                      },
                      // Sefaria-specific HTML styling
                      '& .footnote-marker': {
                        fontSize: '0.75em',
                        verticalAlign: 'super',
                        color: 'text.secondary',
                        fontWeight: 'bold'
                      },
                      '& .footnote': {
                        fontSize: '0.85em',
                        color: 'text.secondary',
                        fontStyle: 'italic'
                      },
                      '& .mam-spi-samekh': {
                        letterSpacing: '0.2em'
                      },
                      '& sup': {
                        fontSize: '0.75em',
                        verticalAlign: 'super',
                        color: 'text.secondary'
                      },
                      '& sub': {
                        fontSize: '0.75em',
                        verticalAlign: 'sub'
                      },
                      '& big': {
                        fontSize: '1.2em'
                      },
                      '& small': {
                        fontSize: '0.85em'
                      }
                    }}
                  >
                    <HighlightedText
                      text={line}
                      highlights={highlights}
                      searchQuery={searchQuery}
                      lineRef={lineRef}
                      isHebrew={false}
                    />
                  </Typography>
                )
              })}
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

export default TextContent
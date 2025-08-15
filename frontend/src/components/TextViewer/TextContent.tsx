import React, { useMemo } from 'react'
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  useTheme
} from '@mui/material'
import { SefariaText, TextSection, SearchHighlight } from '../../types'

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
}

const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlights,
  searchQuery,
  lineRef
}) => {
  const theme = useTheme()

  const highlightedText = useMemo(() => {
    if (!highlights.length && !searchQuery) {
      return text
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

  highlights = [],
  searchQuery,
  loading = false,
  isMobile = false
}) => {
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
                      }
                    }}
                  >
                    <HighlightedText
                      text={line}
                      highlights={highlights}
                      searchQuery={searchQuery}
                      lineRef={lineRef}
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
                      }
                    }}
                  >
                    <HighlightedText
                      text={line}
                      highlights={highlights}
                      searchQuery={searchQuery}
                      lineRef={lineRef}
                    />
                  </Typography>
                )
              })}
            </Box>
          </Paper>
        )}
      </Box>

      {/* Version information */}
      {text.versions && text.versions.length > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Text Versions:
          </Typography>
          {text.versions.map((version, index) => (
            <Typography key={index} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {version.language}: {version.versionTitle}
              {version.versionSource && ` (${version.versionSource})`}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default TextContent
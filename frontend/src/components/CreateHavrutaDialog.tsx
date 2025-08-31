import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material'
import { MenuBook, Group } from '@mui/icons-material'
import { sefariaService } from '../services/sefariaService'
import { SefariaIndex } from '../types'

interface CreateHavrutaDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  onCreateHavruta?: (data: {
    name: string
    bookId: string
    bookTitle: string
    lastPlace?: string
  }) => Promise<void>
}

// Helper function to generate common starting sections for different text types
const generateStartingSections = (book: SefariaIndex): string[] => {
  const title = book.title
  
  // For Torah books, start with chapter 1
  if (book.categories.includes('Torah')) {
    return [`${title} 1:1`, `${title} 2:1`, `${title} 6:1`, `${title} 12:1`]
  }
  
  // For Mishnah, start with chapter 1
  if (book.categories.includes('Mishnah')) {
    return [`${title} 1:1`, `${title} 2:1`, `${title} 3:1`]
  }
  
  // For Talmud, use page numbers
  if (book.categories.includes('Talmud')) {
    return [`${title} 2a`, `${title} 10a`, `${title} 20a`]
  }
  
  // For commentaries and other texts, default to chapter 1
  return [`${title} 1:1`, `${title} 1:2`, `${title} 2:1`]
}

interface CategoryLevel {
  title: string
  heTitle?: string
  category: string
  contents?: any[]
  isBook?: boolean
}

interface SefariaCategory {
  category?: string
  heCategory?: string
  title?: string
  heTitle?: string
  contents?: SefariaCategory[]
}

export const CreateHavrutaDialog: React.FC<CreateHavrutaDialogProps> = ({
  open,
  onClose,
  onSuccess,
  onCreateHavruta,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    bookId: '',
    bookTitle: '',
    lastPlace: '',
  })
  const [selectedBook, setSelectedBook] = useState<SefariaIndex | null>(null)
  const [indexData, setIndexData] = useState<SefariaCategory[]>([])
  const [categoryPath, setCategoryPath] = useState<CategoryLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState<CategoryLevel[]>([])
  const [isLoadingBooks, setIsLoadingBooks] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load index from Sefaria API when dialog opens
  useEffect(() => {
    if (open && indexData.length === 0) {
      loadIndex()
    }
  }, [open, indexData.length])

  const loadIndex = async () => {
    setIsLoadingBooks(true)
    setError(null)
    
    try {
      const data = await sefariaService.getIndex() as SefariaCategory[]
      setIndexData(data)
      
      // Set up the top-level categories
      const topLevel = data.map(item => ({
        title: item.category || item.title || 'Unknown',
        heTitle: item.heCategory || item.heTitle,
        category: item.category || item.title || 'Unknown',
        contents: item.contents,
        isBook: !item.contents && !!item.title
      }))
      
      setCurrentLevel(topLevel)
      console.log(`Loaded Sefaria index with ${topLevel.length} top-level categories`)
    } catch (error) {
      console.error('Error loading Sefaria index:', error)
      setError('Failed to load books from Sefaria. Please try again.')
    } finally {
      setIsLoadingBooks(false)
    }
  }

  const handleCategorySelect = (item: CategoryLevel) => {
    if (item.isBook) {
      // This is a final book selection
      const book: SefariaIndex = {
        title: item.title,
        heTitle: item.heTitle || item.title,
        categories: [...categoryPath.map(c => c.category), item.category],
        primary_category: categoryPath[0]?.category || item.category
      }
      
      setSelectedBook(book)
      const startingSections = generateStartingSections(book)
      setFormData(prev => ({
        ...prev,
        bookId: book.title,
        bookTitle: book.title,
        lastPlace: startingSections[0],
      }))
      
      // Auto-generate name if empty
      if (!formData.name) {
        setFormData(prev => ({
          ...prev,
          name: `${book.title} Study Group`,
        }))
      }
    } else {
      // Navigate deeper into the category
      const newPath = [...categoryPath, item]
      setCategoryPath(newPath)
      
      // Set up the next level
      const nextLevel = (item.contents || []).map((subItem: SefariaCategory) => ({
        title: subItem.category || subItem.title || 'Unknown',
        heTitle: subItem.heCategory || subItem.heTitle,
        category: subItem.category || subItem.title || 'Unknown',
        contents: subItem.contents,
        isBook: !subItem.contents && !!subItem.title
      }))
      
      setCurrentLevel(nextLevel)
    }
  }

  const handleBackNavigation = () => {
    if (categoryPath.length === 0) return
    
    const newPath = categoryPath.slice(0, -1)
    setCategoryPath(newPath)
    
    if (newPath.length === 0) {
      // Back to top level
      const topLevel = indexData.map(item => ({
        title: item.category || item.title,
        heTitle: item.heCategory || item.heTitle,
        category: item.category || item.title,
        contents: item.contents,
        isBook: !item.contents && !!item.title
      }))
      setCurrentLevel(topLevel)
    } else {
      // Back to previous level
      const parentCategory = newPath[newPath.length - 1]
      const nextLevel = (parentCategory.contents || []).map((subItem: SefariaCategory) => ({
        title: subItem.category || subItem.title || 'Unknown',
        heTitle: subItem.heCategory || subItem.heTitle,
        category: subItem.category || subItem.title || 'Unknown',
        contents: subItem.contents,
        isBook: !subItem.contents && !!subItem.title
      }))
      setCurrentLevel(nextLevel)
    }
  }

  const resetBookSelection = () => {
    setSelectedBook(null)
    setCategoryPath([])
    setCurrentLevel(indexData.map(item => ({
      title: item.category || item.title || 'Unknown',
      heTitle: item.heCategory || item.heTitle,
      category: item.category || item.title || 'Unknown',
      contents: item.contents,
      isBook: !item.contents && !!item.title
    })))
    setFormData(prev => ({
      ...prev,
      bookId: '',
      bookTitle: '',
      lastPlace: '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.bookId || !formData.lastPlace) {
      setError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (onCreateHavruta) {
        await onCreateHavruta({
          name: formData.name.trim(),
          bookId: formData.bookId,
          bookTitle: formData.bookTitle,
          lastPlace: formData.lastPlace,
        })
      } else {
        // Fallback to direct service call
        const { havrutaService } = await import('../services/havrutaService')
        await havrutaService.createHavruta({
          name: formData.name.trim(),
          bookId: formData.bookId,
          bookTitle: formData.bookTitle,
          lastPlace: formData.lastPlace,
        })
      }

      // Reset form
      setFormData({
        name: '',
        bookId: '',
        bookTitle: '',
        currentSection: '',
      })
      setSelectedBook(null)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating Havruta:', error)
      setError(error instanceof Error ? error.message : 'Failed to create Havruta')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        bookId: '',
        bookTitle: '',
        currentSection: '',
      })
      setSelectedBook(null)
      setCategoryPath([])
      setCurrentLevel([])
      setError(null)
      onClose()
    }
  }

  const availableSections = selectedBook 
    ? generateStartingSections(selectedBook)
    : []

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: handleSubmit,
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Group color="primary" />
        Create New Havruta
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          {error && (
            <Alert 
              severity="error" 
              onClose={() => setError(null)}
              action={
                error.includes('Failed to load books') ? (
                  <Button color="inherit" size="small" onClick={loadIndex}>
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          )}

          <TextField
            label="Havruta Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Genesis Study Group"
            required
            fullWidth
            disabled={isSubmitting}
          />

          {/* Book Selection - Hierarchical Navigation */}
          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MenuBook color="primary" />
              Select Book
              {selectedBook && (
                <Button size="small" onClick={resetBookSelection}>
                  Change Selection
                </Button>
              )}
            </Typography>

            {selectedBook ? (
              // Show selected book
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
                <Typography variant="h6" color="success.main">
                  {selectedBook.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedBook.heTitle} • {selectedBook.primary_category}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Path: {categoryPath.map(c => c.title).join(' > ')} {' > '} {selectedBook.title}
                </Typography>
              </Paper>
            ) : (
              // Show category navigation
              <Box>
                {/* Breadcrumb Navigation */}
                {categoryPath.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={handleBackNavigation}
                        startIcon={<span>{'←'}</span>}
                      >
                        Back
                      </Button>
                      <Button 
                        size="small" 
                        variant="text"
                        onClick={() => {
                          setCategoryPath([])
                          setCurrentLevel(indexData.map(item => ({
                            title: item.category || item.title || 'Unknown',
                            heTitle: item.heCategory || item.heTitle,
                            category: item.category || item.title || 'Unknown',
                            contents: item.contents,
                            isBook: !item.contents && !!item.title
                          })))
                        }}
                      >
                        Start Over
                      </Button>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Current path:</strong> {categoryPath.map(c => c.title).join(' > ')}
                    </Typography>
                  </Paper>
                )}

                {/* Current Level Options */}
                {isLoadingBooks ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Loading Sefaria library...
                    </Typography>
                  </Box>
                ) : currentLevel.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Typography color="text.secondary">
                      No items found in this category
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {categoryPath.length === 0 
                        ? `Choose from ${currentLevel.length} main categories:`
                        : `Choose from ${currentLevel.length} items:`
                      }
                    </Typography>
                    <Box sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      {currentLevel.map((item, index) => (
                        <Button
                          key={index}
                          variant="text"
                          fullWidth
                          sx={{ 
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            py: 1.5,
                            px: 2,
                            borderRadius: 0,
                            borderBottom: index < currentLevel.length - 1 ? 1 : 0,
                            borderColor: 'divider',
                            '&:hover': {
                              bgcolor: 'action.hover'
                            }
                          }}
                          onClick={() => handleCategorySelect(item)}
                        >
                          <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ fontSize: '1.2em' }}>
                              {item.isBook ? '📖' : '📁'}
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: item.isBook ? 600 : 400 }}>
                                {item.title}
                              </Typography>
                              {item.heTitle && item.heTitle !== item.title && (
                                <Typography variant="body2" color="text.secondary">
                                  {item.heTitle}
                                </Typography>
                              )}
                            </Box>
                            {!item.isBook && (
                              <Typography variant="caption" color="text.secondary">
                                {'→'}
                              </Typography>
                            )}
                          </Box>
                        </Button>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {selectedBook && (
            <FormControl fullWidth disabled={isSubmitting}>
              <InputLabel>Starting Section</InputLabel>
              <Select
                value={formData.currentSection}
                label="Starting Section"
                onChange={(e) => setFormData(prev => ({ ...prev, currentSection: e.target.value }))}
              >
                {availableSections.map((section) => (
                  <MenuItem key={section} value={section}>
                    {section}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Note:</strong> After creating your Havruta, you can invite study partners 
              and schedule regular sessions. The Havruta will start from the selected section 
              and automatically track your progress as you study together.
            </Typography>
            {isLoadingBooks && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading books from Sefaria library...
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting || !formData.name.trim() || !formData.bookId}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : <Group />}
        >
          {isSubmitting ? 'Creating...' : 'Create Havruta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
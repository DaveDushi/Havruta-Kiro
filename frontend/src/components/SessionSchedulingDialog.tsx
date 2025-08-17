import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material'
// Using native HTML datetime-local input for simplicity
// TODO: Consider adding @mui/x-date-pickers for better UX
import { schedulingService, RecurrencePattern } from '../services/schedulingService'
import { Havruta } from '../types'

interface SessionSchedulingDialogProps {
  open: boolean
  onClose: () => void
  havruta: Havruta | null
  onSuccess: (message: string) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const SessionSchedulingDialog: React.FC<SessionSchedulingDialogProps> = ({
  open,
  onClose,
  havruta,
  onSuccess,
}) => {
  const [startTime, setStartTime] = useState<Date>(new Date())
  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrencePattern['frequency']>('weekly')
  const [interval, setInterval] = useState(1)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      resetForm()
    }
  }

  const resetForm = () => {
    setStartTime(new Date())
    setIsRecurring(false)
    setFrequency('weekly')
    setInterval(1)
    setEndDate(null)
    setSelectedDays([])
    setError(null)
  }

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const validateForm = (): string | null => {
    if (!havruta) return 'No Havruta selected'
    if (!startTime) return 'Start time is required'
    if (startTime < new Date()) return 'Start time must be in the future'
    
    if (isRecurring) {
      if ((frequency === 'weekly' || frequency === 'bi-weekly') && selectedDays.length === 0) {
        return 'Please select at least one day of the week for weekly/bi-weekly sessions'
      }
      if (interval < 1 || interval > 365) {
        return 'Interval must be between 1 and 365'
      }
      if (endDate && endDate <= startTime) {
        return 'End date must be after start time'
      }
    }
    
    return null
  }

  const handleSchedule = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!havruta) return

    setIsLoading(true)
    setError(null)

    try {
      const sessionData = {
        havrutaId: havruta.id,
        startTime: startTime.toISOString(),
        participantIds: havruta.participants.map(p => p.user.id),
        isRecurring,
        ...(isRecurring && {
          recurrencePattern: {
            frequency,
            interval,
            ...(endDate && { endDate: endDate.toISOString() }),
            daysOfWeek: (frequency === 'weekly' || frequency === 'bi-weekly') ? selectedDays : []
          }
        })
      }

      const result = await schedulingService.scheduleSession(sessionData)
      
      if (result.sessions) {
        onSuccess(`Successfully scheduled ${result.sessions.length} recurring sessions`)
      } else {
        onSuccess('Session scheduled successfully')
      }
      
      handleClose()
    } catch (error) {
      console.error('Error scheduling session:', error)
      setError(error instanceof Error ? error.message : 'Failed to schedule session')
    } finally {
      setIsLoading(false)
    }
  }

  const getFrequencyDescription = () => {
    switch (frequency) {
      case 'daily':
        return interval === 1 ? 'Every day' : `Every ${interval} days`
      case 'weekly':
        return interval === 1 ? 'Every week' : `Every ${interval} weeks`
      case 'bi-weekly':
        return interval === 1 ? 'Every 2 weeks' : `Every ${interval * 2} weeks`
      case 'monthly':
        return interval === 1 ? 'Every month' : `Every ${interval} months`
      default:
        return 'Once'
    }
  }

  return (
    <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '500px' }
        }}
      >
        <DialogTitle>
          Schedule Session
          {havruta && (
            <Typography variant="subtitle2" color="text.secondary">
              for {havruta.name} - {havruta.bookTitle}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Start Time */}
            <Grid item xs={12}>
              <TextField
                label="Start Time"
                type="datetime-local"
                value={startTime.toISOString().slice(0, 16)}
                onChange={(e) => setStartTime(new Date(e.target.value))}
                fullWidth
                required
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  min: new Date().toISOString().slice(0, 16)
                }}
              />
            </Grid>

            {/* Recurring Options */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                }
                label="Make this a recurring session"
              />
            </Grid>

            {isRecurring && (
              <>
                {/* Frequency */}
                <Grid item xs={12} sm={6}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Frequency</FormLabel>
                    <RadioGroup
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as RecurrencePattern['frequency'])}
                    >
                      <FormControlLabel value="daily" control={<Radio />} label="Daily" />
                      <FormControlLabel value="weekly" control={<Radio />} label="Weekly" />
                      <FormControlLabel value="bi-weekly" control={<Radio />} label="Bi-weekly" />
                      <FormControlLabel value="monthly" control={<Radio />} label="Monthly" />
                    </RadioGroup>
                  </FormControl>
                </Grid>

                {/* Interval */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Repeat every"
                    type="number"
                    value={interval}
                    onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1, max: 365 }}
                    helperText={getFrequencyDescription()}
                    fullWidth
                  />
                </Grid>

                {/* Days of Week (for weekly/bi-weekly) */}
                {(frequency === 'weekly' || frequency === 'bi-weekly') && (
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <FormLabel component="legend">Days of the week</FormLabel>
                      <Box sx={{ mt: 1 }}>
                        {DAYS_OF_WEEK.map((day) => (
                          <Chip
                            key={day.value}
                            label={day.label}
                            onClick={() => handleDayToggle(day.value)}
                            color={selectedDays.includes(day.value) ? 'primary' : 'default'}
                            variant={selectedDays.includes(day.value) ? 'filled' : 'outlined'}
                            sx={{ mr: 1, mb: 1 }}
                          />
                        ))}
                      </Box>
                    </FormControl>
                  </Grid>
                )}

                {/* End Date */}
                <Grid item xs={12}>
                  <TextField
                    label="End Date (optional)"
                    type="datetime-local"
                    value={endDate ? endDate.toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                    }}
                    inputProps={{
                      min: startTime.toISOString().slice(0, 16)
                    }}
                  />
                </Grid>
              </>
            )}

            {/* Participants Info */}
            {havruta && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Participants ({havruta.participants.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {havruta.participants.map((participant) => (
                    <Chip
                      key={participant.user.id}
                      label={participant.user.name}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Scheduling...' : 'Schedule Session'}
          </Button>
        </DialogActions>
      </Dialog>
  )
}

export default SessionSchedulingDialog
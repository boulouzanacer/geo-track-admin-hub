import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface TrackingFilterProps {
  selectedDate: Date | null;
  startTime: string;
  endTime: string;
  onDateChange: (date: Date | null) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onApplyFilter: () => void;
  onClearFilter: () => void;
  isLoading?: boolean;
}

export function TrackingFilter({
  selectedDate,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onApplyFilter,
  onClearFilter,
  isLoading = false
}: TrackingFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Movement Tracking Filter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    onDateChange(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={onApplyFilter} 
            disabled={!selectedDate || !startTime || !endTime || isLoading}
            className="flex-1"
          >
            <Filter className="h-4 w-4 mr-2" />
            {isLoading ? 'Loading...' : 'Show Movement'}
          </Button>
          <Button variant="outline" onClick={onClearFilter}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        {selectedDate && startTime && endTime && (
          <div className="text-sm text-muted-foreground">
            Showing movement from {startTime} to {endTime} on {format(selectedDate, 'PPP')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
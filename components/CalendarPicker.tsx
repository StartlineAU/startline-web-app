"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface CalendarPickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
}

export default function CalendarPicker({
  selectedDate,
  onDateSelect,
}: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      onDateSelect(null);
    } else {
      onDateSelect(day);
    }
  };

  const handleClearDate = () => {
    onDateSelect(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-light-dark p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-dark">Select Date</h3>
        </div>
        {selectedDate && (
          <button
            onClick={handleClearDate}
            className="text-sm text-muted hover:text-primary transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Selected Date Display */}
      {selectedDate && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg">
          <p className="text-sm text-muted">Selected:</p>
          <p className="font-semibold text-dark">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-light rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-dark" />
        </button>
        <h4 className="font-semibold text-dark">
          {format(currentMonth, "MMMM yyyy")}
        </h4>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-light rounded-lg transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-dark" />
        </button>
      </div>

      {/* Week Days Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={index}
              onClick={() => handleDateClick(day)}
              disabled={!isCurrentMonth}
              className={`
                aspect-square flex items-center justify-center text-sm rounded-lg transition-all duration-200
                ${!isCurrentMonth ? "text-muted/40 cursor-not-allowed" : "hover:bg-light cursor-pointer"}
                ${isSelected ? "bg-primary text-dark font-semibold hover:bg-primary-light" : ""}
                ${isTodayDate && !isSelected ? "border-2 border-primary text-primary font-semibold" : ""}
                ${isCurrentMonth && !isSelected && !isTodayDate ? "text-dark" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {/* Quick Select */}
      <div className="mt-4 pt-4 border-t border-light-dark">
        <p className="text-xs text-muted mb-2">Quick Select:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onDateSelect(new Date())}
            className="text-xs px-3 py-1.5 bg-light hover:bg-light-dark rounded-full transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              onDateSelect(tomorrow);
            }}
            className="text-xs px-3 py-1.5 bg-light hover:bg-light-dark rounded-full transition-colors"
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              onDateSelect(nextWeek);
            }}
            className="text-xs px-3 py-1.5 bg-light hover:bg-light-dark rounded-full transition-colors"
          >
            Next Week
          </button>
        </div>
      </div>
    </div>
  );
}

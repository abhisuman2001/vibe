// Abhishek Suman made changes: Type declarations for react-calendar-heatmap
declare module 'react-calendar-heatmap' {
  import { ComponentType } from 'react';

  interface CalendarHeatmapProps {
    startDate: Date;
    endDate: Date;
    values: Array<{ date: Date; count: number }>;
    classForValue?: (value: { date: Date; count: number } | null | undefined) => string;
    tooltipDataAttrs?: (value: { date: Date; count: number } | null) => { [key: string]: string };
    showWeekdayLabels?: boolean;
    squareSize?: number;
    gutterSize?: number;
    horizontal?: boolean;
    transformDayElement?: (element: any, date: Date, index: number) => any;
  }

  const CalendarHeatmap: ComponentType<CalendarHeatmapProps>;
  export default CalendarHeatmap;
}
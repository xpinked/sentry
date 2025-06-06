import moment from 'moment-timezone';

import {useTimezone} from 'sentry/components/timezoneProvider';
import {getFormat} from 'sentry/utils/dates';
import {useUser} from 'sentry/utils/useUser';

export interface DateTimeProps extends React.HTMLAttributes<HTMLTimeElement> {
  /**
   * Input date.
   */
  date: moment.MomentInput;
  /**
   * If true, will only return the date part, e.g. "Jan 1".
   */
  dateOnly?: boolean;
  /**
   * When set, will force the date time display to be in the specified timezone
   */
  forcedTimezone?: string;
  /**
   * Formatting string. If specified, this formatting string will override all
   * other formatting props (dateOnly, timeOnly, year).
   */
  format?: string;
  /**
   * Whether to show the seconds. Is false by default.
   */
  seconds?: boolean;
  /**
   * If true, will only return the time part, e.g. "2:50 PM"
   */
  timeOnly?: boolean;
  /**
   * Whether to show the time zone. If not specified, the returned date string
   * will not contain the time zone _unless_ the time is UTC, in which case
   * the user would want to know that it's UTC and not their own time zone.
   */
  timeZone?: boolean;
  /**
   * Whether the date input is UTC time or not.
   */
  utc?: boolean;
  /**
   * Whether to show the year. If not specified, the returned date string will
   * not contain the year _if_ the date is not in the current calendar year.
   * For example: "Feb 1" (2022), "Jan 1" (2022), "Dec 31, 2021".
   */
  year?: boolean;
}

export function DateTime({
  format,
  date,
  utc,
  dateOnly,
  timeOnly,
  year,
  timeZone,
  seconds = false,
  forcedTimezone,
  ...props
}: DateTimeProps) {
  const user = useUser();
  const currentTimezone = useTimezone();

  const tz = forcedTimezone ?? currentTimezone;

  const formatString =
    format ??
    getFormat({
      dateOnly,
      timeOnly,
      // If the year prop is defined, then use it. Otherwise only show the year if `date`
      // is in the current year.
      year: year ?? moment.tz(tz).year() !== moment.tz(date, tz).year(),
      // If timeZone is defined, use it. Otherwise only show the time zone if we're using
      // UTC time.
      timeZone: timeZone ?? utc,
      seconds,
      clock24Hours: user?.options.clock24Hours,
    });

  return (
    <time {...props}>
      {utc
        ? moment.utc(date).format(formatString)
        : moment.tz(date, tz).format(formatString)}
    </time>
  );
}

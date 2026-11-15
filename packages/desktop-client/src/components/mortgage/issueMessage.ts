import type { ValidationIssue } from '@actual-app/core/shared/mortgage';
import { MAX_YEARS } from '@actual-app/core/shared/mortgage';
import type { TFunction } from 'i18next';

/** Plain-language, translated explanation for a validation issue. */
export function issueMessage(issue: ValidationIssue, t: TFunction): string {
  switch (`${issue.field}:${issue.code}`) {
    case 'tracks:noTracks':
      return t('Add at least one track to see a result.');
    case 'prime:negative':
      return t('The prime rate cannot be negative.');
    case 'cpi:tooHigh':
      return t('Expected CPI should be between -20% and 50% per year.');
    case 'name:required':
      return t('Give the track a name.');
    case 'principal:required':
      return t('Enter a loan amount greater than zero.');
    case 'years:required':
      return t('Enter the number of years (more than zero).');
    case 'years:tooLong':
      return t('A mortgage track can be at most {{max}} years.', {
        max: MAX_YEARS,
      });
    case 'rate:tooLow':
      return t(
        'The rate (prime plus margin) cannot be negative. Raise the margin or the prime.',
      );
    default:
      return t('Please check this value.');
  }
}

// Temporary accessibility fixes for base primitives
// TODO: These should be fixed in the base primitives themselves

export function filterMultiSelectContainerProps(props: any) {
  const { 'aria-multiselectable': _, ...filtered } = props;
  // Add aria-label if missing
  if (!filtered['aria-label']) {
    filtered['aria-label'] = 'Select options';
  }
  return filtered;
}

export function filterRatingContainerProps(props: any) {
  const { 
    'aria-valuemin': _,
    'aria-valuemax': __,
    'aria-valuenow': ___,
    'aria-valuetext': ____,
    ...filtered 
  } = props;
  return filtered;
}
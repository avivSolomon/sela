import * as React from 'react';
import type { SVGProps } from 'react';
export const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 30 32"
    style={{
      color: 'inherit',
      ...props.style,
    }}
  >
    <path
      fill="currentColor"
      d="M1.5 28.5 7.2 12.4a1.2 1.2 0 0 1 .5-.6L14 8.2l2.4-5.6a1 1 0 0 1 1.7-.2l9.9 13.6a1.2 1.2 0 0 1 .2.6l.8 11.2a1 1 0 0 1-1 1.1H2.4a1 1 0 0 1-.9-1.4"
    />
    <path
      fill="#fff"
      fillOpacity=".35"
      d="m14 8.2 4.6 6.6-2.1 13.7H9.1l1.8-11.3zM18.6 14.8l6.1 4.4-1.2 9.3h-7z"
    />
  </svg>
);

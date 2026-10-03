import { useId } from 'react';
import './qlean-logo.css';

const silhouette = 'M12 0H76Q88 0 88 12V68Q88 75 93 80L98 85Q102 89 98 93L91 100Q87 104 83 100L76 93Q71 88 66 88H12Q0 88 0 76V12Q0 0 12 0Z';

type QleanLogoProps = {
  variant?: 'default' | 'compact' | 'inline';
};

export function QleanLogo({ variant = 'default' }: QleanLogoProps) {
  const id = useId();
  const bodyClip = `${id}-body`;
  const eyeClip = `${id}-eye`;
  const className = variant === 'default' ? 'qlean-logo' : `qlean-logo qlean-logo--${variant}`;

  return <span className={className} aria-hidden="true">
    <svg className="qlean-logo__mark" viewBox="0 0 100 104" focusable="false">
      <defs>
        <clipPath id={bodyClip}><path d={silhouette} /></clipPath>
        <clipPath id={eyeClip}><rect x="22" y="22" width="22" height="44" rx="5" /></clipPath>
      </defs>
      <path className="qlean-logo__body" d={silhouette} />
      <rect className="qlean-logo__eye" x="22" y="22" width="22" height="44" rx="5" />
      <g clipPath={`url(#${eyeClip})`}>
        <rect className="qlean-logo__pupil" x="27.5" y="39" width="9" height="9" rx="3.5" />
      </g>
      <g clipPath={`url(#${bodyClip})`}>
        <path className="qlean-logo__mouth" d="M-5 77.5 Q7 79 18 76.5" />
      </g>
    </svg>
    <span className="qlean-logo__wordmark-window"><span className="qlean-logo__wordmark">LEAN</span></span>
  </span>;
}

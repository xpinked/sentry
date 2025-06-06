import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {useIconDefaults} from 'sentry/icons/useIconDefaults';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconLabProps extends SVGIconProps {
  isSolid?: boolean;
}

function IconLab({isSolid, ...props}: IconLabProps) {
  const theme = useTheme();
  const {color: providedColor = 'currentColor'} = useIconDefaults(props);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const color = theme[providedColor] ?? providedColor;

  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        isSolid ? (
          <Fragment>
            <path d="M12.59,10.96l-2.59-4.21V2.75h-4v4l-2.59,4.21c-.62,1,.1,2.29,1.28,2.29h6.63c1.17,0,1.89-1.29,1.28-2.29Z" />
            <line x1="5" y1="2.75" x2="11" y2="2.75" />
            <path
              fill={color}
              d="M7.79,7.35l-2.3,3.77c-.1.17.02.38.21.38h4.61c.2,0,.32-.21.21-.38l-2.3-3.77c-.1-.16-.33-.16-.43,0Z"
            />
          </Fragment>
        ) : (
          <Fragment>
            <path
              fill={isSolid ? color : 'none'}
              d="m13.06,11.73l-3.06-4.98V2.75h-4v4l-3.06,4.98c-.41.67.07,1.52.85,1.52h8.42c.78,0,1.26-.86.85-1.52Z"
            />
            <line x1="5" y1="2.75" x2="11" y2="2.75" />
            <line x1="4" y1="10.25" x2="12" y2="10.25" />
          </Fragment>
        )
      ) : isSolid ? (
        <path d="M4 12.6667L7.33333 7.33333H8.66667L12 12.6667L11.3333 13.3333H4.66667L4 12.6667Z" />
      ) : (
        <path d="M8,13.29a2.5,2.5,0,1,1,2.5-2.5A2.5,2.5,0,0,1,8,13.29Zm0-3.5a1,1,0,1,0,1,1A1,1,0,0,0,8,9.79Z" />
      )}
      {theme.isChonk ? null : (
        <path d="M11.31,16H4.68a3.45,3.45,0,0,1-3.49-3.4,3.34,3.34,0,0,1,.58-1.88L5.12,5.83V3.89H5a1.51,1.51,0,0,1-1.51-1.5V1.51A1.52,1.52,0,0,1,5,0h6a1.52,1.52,0,0,1,1.51,1.51v.88A1.51,1.51,0,0,1,11,3.89h-.1V5.83l3.35,4.89a3.34,3.34,0,0,1,.58,1.88A3.46,3.46,0,0,1,11.31,16ZM5,1.5v.89h.88a.75.75,0,0,1,.75.75V6.07a.7.7,0,0,1-.13.42L3,11.57a1.82,1.82,0,0,0-.32,1,2,2,0,0,0,2,1.9h6.63a2,2,0,0,0,2-1.9,1.82,1.82,0,0,0-.32-1L9.51,6.49a.7.7,0,0,1-.13-.42V3.14a.75.75,0,0,1,.75-.75H11V1.51Z" />
      )}
    </SvgIcon>
  );
}

IconLab.displayName = 'IconLab';

export {IconLab};

import React from 'react';
import { CanvasElement } from '../types/figma';
import {
  getSvgGradientCoordinates,
  getSvgGradientId,
  getVisibleGradients,
} from '../utils/gradient';

interface SvgGradientDefsProps {
  element: CanvasElement;
  prefix: string;
}

export const SvgGradientDefs: React.FC<SvgGradientDefsProps> = ({ element, prefix }) => (
  <defs>
    {getVisibleGradients(element).map((gradient) => {
      const coordinates = getSvgGradientCoordinates(gradient.angle);
      return (
        <linearGradient
          key={gradient.id}
          id={getSvgGradientId(prefix, element.id, gradient.id)}
          {...coordinates}
        >
          {gradient.stops.map((stop, index) => (
            <stop
              key={`${gradient.id}-${index}`}
              offset={`${Math.max(0, Math.min(100, stop.position))}%`}
              stopColor={stop.color}
              stopOpacity={Math.max(0, Math.min(1, stop.opacity))}
            />
          ))}
        </linearGradient>
      );
    })}
  </defs>
);

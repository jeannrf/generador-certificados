import React, { useMemo } from 'react';
import { qrDarkRuns, qrMatrix, QR_QUIET_ZONE } from '../infra/qr';

interface QrPreviewProps {
  text: string;
  color: string;
  className?: string;
}

/**
 * Vista previa vectorial (SVG) del código QR, idéntica a la que se estampa en el PDF.
 */
export const QrPreview: React.FC<QrPreviewProps> = ({ text, color, className = '' }) => {
  const { size, runs } = useMemo(() => {
    const matrix = qrMatrix(text || ' ');
    return { size: matrix.size + QR_QUIET_ZONE * 2, runs: qrDarkRuns(matrix) };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Código QR"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {runs.map(([row, col, length]) => (
        <rect
          key={`${row}-${col}`}
          x={QR_QUIET_ZONE + col}
          y={QR_QUIET_ZONE + row}
          width={length}
          height={1}
          fill={color}
        />
      ))}
    </svg>
  );
};

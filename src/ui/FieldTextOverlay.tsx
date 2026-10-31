import React from 'react';
import { FieldBox } from '../domain/types';
import { isQrField } from '../domain/fields';
import { fieldFontVariant } from '../domain/fonts';
import { QrPreview } from './QrPreview';

interface FieldTextOverlayProps {
  field: FieldBox;
  text: string;
  fontSizePx: number;
  /** Clases extra para la caja (borde, fondo, cursor…) */
  boxClassName?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  title?: string;
  children?: React.ReactNode;
}

/**
 * Caja posicionada con coordenadas normalizadas sobre la vista previa de una página.
 * Muestra el texto del campo o, si es un campo QR, el código que codifica `text`.
 */
export const FieldTextOverlay: React.FC<FieldTextOverlayProps> = ({
  field,
  text,
  fontSizePx,
  boxClassName = 'pointer-events-none',
  onPointerDown,
  title,
  children,
}) => (
  <div
    onPointerDown={onPointerDown}
    title={title}
    style={{
      left: `${field.x * 100}%`,
      top: `${field.y * 100}%`,
      width: `${field.width * 100}%`,
      height: `${field.height * 100}%`,
    }}
    className={`absolute flex ${boxClassName}`}
  >
    <div
      className={`w-full h-full flex overflow-hidden pointer-events-none ${isQrField(field) ? '' : 'px-[1%]'}`}
      style={{
        alignItems: field.vAlign === 'top' ? 'flex-start' : field.vAlign === 'bottom' ? 'flex-end' : 'center',
        justifyContent: field.align === 'left' ? 'flex-start' : field.align === 'right' ? 'flex-end' : 'center',
      }}
    >
      {isQrField(field) ? (
        <QrPreview text={text} color={field.color} className="h-full max-w-full aspect-square" />
      ) : (
        <span
          className="w-full block leading-normal select-none transition-all px-0.5 whitespace-nowrap overflow-visible"
          style={{
            fontFamily: field.fontFamily,
            fontWeight: fieldFontVariant(field).weight,
            fontStyle: fieldFontVariant(field).italic ? 'italic' : 'normal',
            fontSynthesis: 'none',
            fontSize: `${fontSizePx}px`,
            color: field.color,
            textAlign: field.align,
          }}
        >
          {text}
        </span>
      )}
    </div>
    {children}
  </div>
);

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Componente Canvas interactivo para captura de firma digital.
 * Soporta mouse y touch. Exporta la firma como dataURL base64 PNG.
 *
 * @param {{ disabled?: boolean, onSignatureChange?: (base64OrNull: string|null) => void }} props
 */
export function SignatureCanvas({ disabled = false, onSignatureChange }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getCoordinates = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (event.touches && event.touches.length > 0) {
      return {
        x: (event.touches[0].clientX - rect.left) * scaleX,
        y: (event.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((event) => {
    if (disabled) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const { x, y } = getCoordinates(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled, getCoordinates]);

  const draw = useCallback((event) => {
    if (!isDrawingRef.current || disabled) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [disabled, getCoordinates]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setHasStrokes(true);

    if (onSignatureChange && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [onSignatureChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    if (onSignatureChange) {
      onSignatureChange(null);
    }
  }, [onSignatureChange]);

  // Initialize canvas context with signature-style settings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#10294b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div className={`signature-canvas-wrapper${disabled ? ' signature-disabled' : ''}`}>
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        width={720}
        height={200}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!disabled && (
        <div className="signature-controls">
          <button
            className="signature-btn signature-btn-clear"
            disabled={!hasStrokes}
            onClick={clearCanvas}
            type="button"
          >
            ✕ Limpiar Firma
          </button>
        </div>
      )}
      {disabled && (
        <div className="signature-overlay" aria-hidden="true" />
      )}
    </div>
  );
}

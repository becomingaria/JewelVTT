import React, { useState, useRef, useEffect } from 'react';
import type { HumbugType, Humbug } from '../types/humbug.types';
import './HumbugModal.css';

interface HumbugModalProps {
  isOpen: boolean;
  type: HumbugType;
  position: { x: number; y: number };
  existingHumbug?: Humbug | null;
  onClose: () => void;
  onCreate: (humbugData: Record<string, unknown>) => void;
}

export const HumbugModal: React.FC<HumbugModalProps> = ({
  isOpen,
  type,
  position,
  existingHumbug,
  onClose,
  onCreate,
}) => {
  // Common state for all humbug types
  const [opacity, setOpacity] = useState(1);
  const [size, setSize] = useState({ width: 150, height: 100 });
  
  // Text-specific state
  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  
  // Color-specific state
  const [solidColor, setSolidColor] = useState('#3498db');
  
  // Image-specific state
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  // Map pin-specific state
  const [pinColor, setPinColor] = useState('#e74c3c');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form with existing humbug data when editing
  useEffect(() => {
    if (existingHumbug) {
      setOpacity(existingHumbug.opacity);
      
      if (existingHumbug.type === 'text') {
        setContent(existingHumbug.content);
        setFontSize(existingHumbug.fontSize);
        setFontFamily(existingHumbug.fontFamily);
        setTextColor(existingHumbug.color);
        setBackgroundColor(existingHumbug.backgroundColor || '#ffffff');
        setSize(existingHumbug.size);
      } else if (existingHumbug.type === 'solid-color') {
        setSolidColor(existingHumbug.color);
        setSize(existingHumbug.size);
      } else if (existingHumbug.type === 'image') {
        setImageUrl(existingHumbug.imageUrl);
        setSize(existingHumbug.size);
      } else if (existingHumbug.type === 'map-pin') {
        setPinColor(existingHumbug.color);
      }
    } else {
      // Reset to defaults for new humbug
      setOpacity(1);
      setSize({ width: 150, height: 100 });
      setContent('');
      setFontSize(16);
      setFontFamily('Arial, sans-serif');
      setTextColor('#000000');
      setBackgroundColor('#ffffff');
      setSolidColor('#3498db');
      setImageUrl('');
      setImageFile(null);
      setPinColor('#e74c3c');
    }
  }, [existingHumbug, isOpen]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create a blob URL for preview
      const url = URL.createObjectURL(file);
      setImageUrl(url);
    }
  };

  const handleCreate = () => {
    const baseData = {
      position,
      size,
      opacity,
      type,
    };

    let specificData = {};

    switch (type) {
      case 'text':
        specificData = {
          content,
          fontSize,
          fontFamily,
          color: textColor,
          backgroundColor,
        };
        break;
      case 'solid-color':
        specificData = {
          color: solidColor,
        };
        break;
      case 'image':
        specificData = {
          imageUrl,
          imageFile,
        };
        break;
      case 'map-pin':
        specificData = {
          color: pinColor,
          size: { width: 32, height: 40 }, // Standard pin size
        };
        break;
    }

    onCreate({ ...baseData, ...specificData });
    onClose();
  };

  const renderTypeSpecificControls = () => {
    switch (type) {
      case 'text':
        return (
          <div className="humbug-modal-section">
            <h4>Text Content</h4>
            <div className="form-group">
              <label>Text:</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your text here..."
                rows={4}
                className="text-input"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Font Size:</label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  min={8}
                  max={72}
                />
              </div>
              <div className="form-group">
                <label>Font Family:</label>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, sans-serif">Helvetica</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Times New Roman, serif">Times New Roman</option>
                  <option value="Courier New, monospace">Courier New</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Text Color:</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Background:</label>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 'solid-color':
        return (
          <div className="humbug-modal-section">
            <h4>Color Settings</h4>
            <div className="form-group">
              <label>Color:</label>
              <div className="color-picker-group">
                <input
                  type="color"
                  value={solidColor}
                  onChange={(e) => setSolidColor(e.target.value)}
                />
                <span className="color-value">{solidColor}</span>
              </div>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="humbug-modal-section">
            <h4>Image Source</h4>
            <div className="form-group">
              <label>Upload File:</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="file-input"
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="file-button"
              >
                Choose File
              </button>
            </div>
            <div className="form-separator">OR</div>
            <div className="form-group">
              <label>Image URL:</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="url-input"
              />
            </div>
            {imageUrl && (
              <div className="image-preview">
                <img src={imageUrl} alt="Preview" />
              </div>
            )}
          </div>
        );

      case 'map-pin':
        return (
          <div className="humbug-modal-section">
            <h4>Pin Settings</h4>
            <div className="form-group">
              <label>Pin Color:</label>
              <div className="color-picker-group">
                <input
                  type="color"
                  value={pinColor}
                  onChange={(e) => setPinColor(e.target.value)}
                />
                <span className="color-value">{pinColor}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="humbug-modal-backdrop" onClick={onClose}>
      <div className="humbug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="humbug-modal-header">
          <h3>{existingHumbug ? 'Edit' : 'Create'} {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Humbug</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="humbug-modal-body">
          {/* Type-specific controls */}
          {renderTypeSpecificControls()}

          {/* Common controls */}
          <div className="humbug-modal-section">
            <h4>General Settings</h4>
            
            {type !== 'map-pin' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Width:</label>
                  <input
                    type="number"
                    value={size.width}
                    onChange={(e) => setSize(prev => ({ ...prev, width: Number(e.target.value) }))}
                    min={10}
                    max={500}
                  />
                </div>
                <div className="form-group">
                  <label>Height:</label>
                  <input
                    type="number"
                    value={size.height}
                    onChange={(e) => setSize(prev => ({ ...prev, height: Number(e.target.value) }))}
                    min={10}
                    max={500}
                  />
                </div>
              </div>
            )}
            
            <div className="form-group">
              <label>Opacity: {Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="opacity-slider"
              />
            </div>
          </div>
        </div>

        <div className="humbug-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="create-button" 
            onClick={handleCreate}
            disabled={type === 'image' && !imageUrl && !imageFile}
          >
            {existingHumbug ? 'Update' : 'Create'} Humbug
          </button>
        </div>
      </div>
    </div>
  );
};

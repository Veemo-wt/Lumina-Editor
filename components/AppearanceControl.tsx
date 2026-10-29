import { useId, useRef } from 'react';
import { Check, Moon, Palette, Sun, X } from 'lucide-react';
import { DESIGNS, setDesign, useDesign } from '../appearance/appearance';
import '../appearance/themes.css';

interface AppearanceProps {
  isDark: boolean;
  onModeChange: (dark: boolean) => void;
}

export default function AppearanceControl({ isDark, onModeChange }: AppearanceProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const design = useDesign();

  return (
    <>
      <button type="button" className="ap-trigger" onClick={() => dialog.current?.showModal()} aria-label="Wygląd — personalizacja aplikacji" aria-haspopup="dialog" title="Motywy i wygląd aplikacji">
        <Palette size={17} aria-hidden="true" /><span>Wygląd</span>
      </button>
      <dialog data-lumina-window="" className="ap-dialog" ref={dialog} aria-labelledby={`${id}-title`}>
        <div className="ap-dialog-header">
          <div><span className="ap-eyebrow">TWOJA PRZESTRZEŃ DO PRACY</span><h2 id={`${id}-title`}>Wybierz swój świat</h2></div>
          <button type="button" className="ap-close" onClick={() => dialog.current?.close()} aria-label="Zamknij personalizację"><X size={21} /></button>
        </div>
        <div className="ap-dialog-content">
          <p className="ap-intro">Cztery kompletne oprawy, jedna Lumina. Wybierz typografię, faktury i charakter swojej przestrzeni.</p>
          <fieldset className="ap-mode-field">
            <legend>Oświetlenie</legend>
            <div className="ap-mode-switch">
              {[false, true].map(dark => (
                <label key={String(dark)} className={isDark === dark ? 'is-selected' : ''}>
                  <input type="radio" name={`${id}-mode`} checked={isDark === dark} onChange={() => onModeChange(dark)} />
                  {dark ? <Moon size={16} /> : <Sun size={16} />}<span>{dark ? 'Ciemny' : 'Jasny'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="ap-design-field">
            <legend>Motyw aplikacji</legend>
            <div className="ap-design-grid">
              {DESIGNS.map(item => (
                <label key={item.id} className={`ap-design-card ${design === item.id ? 'is-selected' : ''}`}>
                  <input type="radio" name={`${id}-design`} value={item.id} checked={design === item.id} onChange={() => setDesign(item.id)} aria-label={`${item.name} — ${item.subtitle}`} />
                  <div className="ap-preview" data-preview={item.id} data-mode={isDark ? 'dark' : 'light'} aria-hidden="true">
                    <div className="ap-preview-top"><span className="ap-preview-logo">L</span><span>LUMINA</span><span className="ap-preview-dots">···</span></div>
                    <div className="ap-preview-art"><span /><span /><span /></div>
                    <div className="ap-preview-title">{item.sample}</div>
                    <div className="ap-preview-lines"><i /><i /></div>
                    <div className="ap-preview-bottom"><span /><span /></div>
                  </div>
                  <div className="ap-card-info">
                    <div className="ap-card-title"><h3>{item.name}</h3><span className="ap-selected-mark">{design === item.id && <Check size={15} />}</span></div>
                    <p className="ap-card-subtitle">{item.subtitle}</p>
                    <p className="ap-card-description">{item.description}</p>
                    <span className="ap-type-specimen">{item.typography}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="ap-footnote">Zmiany dotyczą wyłącznie wyglądu. Tekst, ustawienia pracy i wyniki pozostają bez zmian. Motyw i oświetlenie zapisują się automatycznie i są wspólne dla aplikacji Luminy w tej przeglądarce.</p>
        </div>
        <div className="ap-dialog-footer"><span>Podgląd na żywo</span><button type="button" onClick={() => dialog.current?.close()}>Gotowe<Check size={16} /></button></div>
      </dialog>
    </>
  );
}

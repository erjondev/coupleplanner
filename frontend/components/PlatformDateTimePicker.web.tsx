/**
 * Variante WEB du sélecteur de date/heure.
 *
 * `@react-native-community/datetimepicker` ne supporte pas le web, on s'appuie
 * donc sur les champs natifs du navigateur (`<input type="date|time">`), qui
 * ouvrent le calendrier/horloge du système. On imite l'API native utilisée
 * dans l'app (value, mode, onValueChange, onDismiss) afin que les appelants
 * n'aient rien à changer.
 *
 * Rendu via react-dom (react-native-web) : les éléments DOM comme <input>
 * sont donc parfaitement valides ici.
 */
import React from 'react';

interface Props {
  value: Date;
  mode?: 'date' | 'time';
  onValueChange?: (event: { type: 'set' | 'dismissed' }, date: Date) => void;
  onDismiss?: () => void;
}

const pad = (n: number) => `${n}`.padStart(2, '0');

/** Date -> 'YYYY-MM-DD' (valeur d'un <input type="date">, en heure locale). */
function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date -> 'HH:MM' (valeur d'un <input type="time">, en heure locale). */
function toTimeValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlatformDateTimePicker({
  value,
  mode = 'date',
  onValueChange,
  onDismiss,
}: Props) {
  const ref = React.useRef<HTMLInputElement>(null);
  const isTime = mode === 'time';

  // Ouvre immédiatement le sélecteur du navigateur (comme un picker natif).
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // showPicker peut throw (contexte non permis) : on retombe sur focus.
      }
    }
    el.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) return;
    const next = new Date(value);
    if (isTime) {
      const [h, m] = raw.split(':').map(Number);
      next.setHours(h, m, 0, 0);
    } else {
      const [y, mo, d] = raw.split('-').map(Number);
      next.setFullYear(y, mo - 1, d);
    }
    onValueChange?.({ type: 'set' }, next);
  };

  return (
    <input
      ref={ref}
      type={isTime ? 'time' : 'date'}
      defaultValue={isTime ? toTimeValue(value) : toDateValue(value)}
      onChange={handleChange}
      onBlur={() => onDismiss?.()}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid #E5E5E5',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#2C3E50',
        fontFamily: 'inherit',
        marginTop: 4,
      }}
    />
  );
}

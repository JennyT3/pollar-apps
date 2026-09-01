const EMOJIS = ["🐷", "🚲", "✈️", "🎓", "🏠", "🎄", "💍", "📱", "🩺", "🎂", "🚗", "🐣"];

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          aria-pressed={value === emoji}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl transition-colors ${
            value === emoji
              ? "border-primary bg-primary-light"
              : "border-border bg-background hover:bg-surface"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

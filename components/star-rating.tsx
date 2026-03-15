import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

const STAR_FILLED = '★';
const STAR_EMPTY = '☆';

// ─── Read-only display ────────────────────────────────────────────────────────

interface StarRatingDisplayProps {
  rating: number;
  maxStars?: number;
  size?: number;
  showNumber?: boolean;
  reviewCount?: number;
}

export function StarRatingDisplay({
  rating,
  maxStars = 5,
  size = 16,
  showNumber = false,
  reviewCount,
}: StarRatingDisplayProps) {
  const colors = useColors();
  const STAR_COLOR = '#F59E0B'; // amber

  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => {
        const filled = i < Math.floor(rating);
        const partial = !filled && i < rating;
        return (
          <Text
            key={i}
            style={[
              styles.star,
              { fontSize: size, color: filled || partial ? STAR_COLOR : colors.border },
            ]}
          >
            {filled || partial ? STAR_FILLED : STAR_EMPTY}
          </Text>
        );
      })}
      {showNumber && (
        <Text style={[styles.ratingNumber, { fontSize: size * 0.85, color: colors.foreground }]}>
          {rating.toFixed(1)}
        </Text>
      )}
      {reviewCount !== undefined && (
        <Text style={[styles.reviewCount, { fontSize: size * 0.75, color: colors.muted }]}>
          ({reviewCount})
        </Text>
      )}
    </View>
  );
}

// ─── Interactive picker ───────────────────────────────────────────────────────

interface StarRatingPickerProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export function StarRatingPicker({
  value,
  onChange,
  size = 36,
  disabled = false,
}: StarRatingPickerProps) {
  const STAR_COLOR = '#F59E0B';
  const colors = useColors();

  return (
    <View style={styles.pickerRow}>
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= value;
        return (
          <Pressable
            key={i}
            onPress={() => !disabled && onChange(starValue)}
            style={({ pressed }) => [
              styles.starButton,
              pressed && !disabled && { transform: [{ scale: 1.2 }] },
            ]}
            accessibilityLabel={`Rate ${starValue} star${starValue !== 1 ? 's' : ''}`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.star,
                {
                  fontSize: size,
                  color: filled ? STAR_COLOR : colors.border,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              {filled ? STAR_FILLED : STAR_EMPTY}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Rating bar (for distribution chart) ─────────────────────────────────────

interface RatingBarProps {
  starValue: number;
  count: number;
  total: number;
}

export function RatingBar({ starValue, count, total }: RatingBarProps) {
  const colors = useColors();
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.muted }]}>{starValue}★</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` as any, backgroundColor: '#F59E0B' },
          ]}
        />
      </View>
      <Text style={[styles.barCount, { color: colors.muted }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    lineHeight: undefined,
  },
  ratingNumber: {
    fontWeight: '700',
    marginLeft: 4,
  },
  reviewCount: {
    marginLeft: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  barLabel: {
    width: 24,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  barCount: {
    width: 24,
    fontSize: 12,
    textAlign: 'right',
  },
});

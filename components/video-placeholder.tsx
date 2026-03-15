import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface VideoPlaceholderProps {
  width?: number | string;
  height?: number;
  label?: string;
  style?: object;
}

export function VideoPlaceholder({
  width = '100%',
  height = 200,
  label = 'Add Video Preview',
  style,
}: VideoPlaceholderProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          width: width as number,
          height,
          backgroundColor: colors.foreground + '10',
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={[styles.playButton, { backgroundColor: colors.primary + 'CC' }]}>
        <MaterialIcons name="play-arrow" size={36} color="#FFFFFF" />
      </View>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});

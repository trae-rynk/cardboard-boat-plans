import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface ImagePlaceholderProps {
  width?: number | string;
  height?: number;
  label?: string;
  iconSize?: number;
  style?: object;
}

export function ImagePlaceholder({
  width = '100%',
  height = 200,
  label = 'Add Photo',
  iconSize = 32,
  style,
}: ImagePlaceholderProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          width: width as number,
          height,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <MaterialIcons name="add-a-photo" size={iconSize} color={colors.muted} />
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
